// Доступ к серверу: чтение через fetch с cookie сессии, изменения — с CSRF-токеном.
import { CROSS_ORIGIN_API, apiUrl } from '../config';
import type { Csrf } from './types';

/** Сервер ответил ошибкой. status хранит код HTTP. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message = `Ошибка сервера (${status})`,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 401: сессии нет или она истекла. */
export class AuthError extends ApiError {
  constructor() {
    super(401, 'Требуется вход');
    this.name = 'AuthError';
  }
}

/** Запрос не дошёл до сервера: нет сети или сервер недоступен. */
export class NetworkError extends Error {
  constructor() {
    super('Нет связи с сервером');
    this.name = 'NetworkError';
  }
}

const credentials: RequestCredentials = CROSS_ORIGIN_API ? 'include' : 'same-origin';

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(apiUrl(path), { credentials, ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new NetworkError();
  }
}

function ensureOk(r: Response): Response {
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new ApiError(r.status);
  return r;
}

/** Тело ответа как JSON; пустой ответ (204 или без тела) — undefined. */
async function readJson<T>(r: Response): Promise<T> {
  const text = r.status === 204 ? '' : await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

let csrf: Csrf | null = null;

async function getCsrf(): Promise<Csrf> {
  if (!csrf) {
    const r = ensureOk(await request('/api/csrf', { headers: { Accept: 'application/json' } }));
    csrf = await readJson<Csrf>(r);
  }
  return csrf;
}

/** После входа и выхода сессия меняется, и старый токен перестаёт подходить. */
export function resetCsrf() {
  csrf = null;
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = ensureOk(await request(path, { headers: { Accept: 'application/json' }, signal }));
  return readJson<T>(r);
}

/** Ответ как текст (например, Markdown документа). */
export async function getText(path: string, signal?: AbortSignal): Promise<string> {
  const r = ensureOk(await request(path, { headers: { Accept: 'text/plain, text/markdown, */*' }, signal }));
  return r.text();
}

type Method = 'POST' | 'PUT' | 'DELETE';
/** Тело запроса. Без contentType заголовок ставит браузер: для FormData он сам добавляет boundary. */
type Payload = { body?: BodyInit; contentType?: string };

const jsonPayload = (json: unknown): Payload =>
  json === undefined ? {} : { body: JSON.stringify(json), contentType: 'application/json' };

/** Изменяющий запрос с CSRF. Если токен устарел (403), запрашивает новый и повторяет один раз. Ответ не проверяется. */
async function sendRaw(path: string, method: Method, { body, contentType }: Payload = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await getCsrf();
    const headers: Record<string, string> = { [token.headerName]: token.token, Accept: 'application/json' };
    if (contentType) headers['Content-Type'] = contentType;
    const r = await request(path, { method, headers, body });
    if (r.status === 403 && attempt === 0) {
      resetCsrf();
      continue;
    }
    return r;
  }
}

/** Как ensureOk, но текст ошибки берёт из тела { error }, если сервер его прислал (413, 400 и т. п.). */
async function ensureOkWithMessage(r: Response): Promise<Response> {
  if (r.ok || r.status === 401) return ensureOk(r);
  let message: string | undefined;
  try {
    const body = (await r.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) message = body.error;
  } catch {
    // тело не JSON — остаётся общий текст с кодом
  }
  throw new ApiError(r.status, message);
}

/** Изменяющий запрос. Бросает ApiError при любом ответе, кроме 2xx. */
export async function send<T = void>(path: string, method: 'POST' | 'PUT', json?: unknown): Promise<T> {
  const r = ensureOk(await sendRaw(path, method, jsonPayload(json)));
  return readJson<T>(r);
}

/** Текст в теле (например, Markdown документа базы знаний). */
export async function sendText<T = void>(path: string, method: 'PUT', text: string, contentType: string): Promise<T> {
  const r = await ensureOkWithMessage(await sendRaw(path, method, { body: text, contentType }));
  return readJson<T>(r);
}

/** Загрузка файлов multipart/form-data; все файлы уходят в одном поле. */
export async function upload<T>(path: string, files: File[], field = 'files'): Promise<T> {
  const form = new FormData();
  for (const f of files) form.append(field, f, f.name);
  const r = await ensureOkWithMessage(await sendRaw(path, 'POST', { body: form }));
  return readJson<T>(r);
}

export async function del(path: string): Promise<void> {
  await ensureOkWithMessage(await sendRaw(path, 'DELETE'));
}

/** true — вошли, false — неверный логин или пароль. Остальные сбои (сеть, 5xx) — исключение. */
export async function login(username: string, password: string): Promise<boolean> {
  const r = await sendRaw('/api/login', 'POST', {
    body: new URLSearchParams({ username, password }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  });
  resetCsrf();
  if (r.status === 401) return false;
  if (!r.ok) throw new ApiError(r.status);
  return true;
}

export async function logout(): Promise<void> {
  const r = await sendRaw('/api/logout', 'POST');
  resetCsrf();
  if (!r.ok) throw new ApiError(r.status);
}

/** Текст ошибки для показа пользователю. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof NetworkError) return e.message;
  return 'Что-то пошло не так';
}
