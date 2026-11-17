// Публичный чат по базе знаний: без входа и без CSRF. Ответ приходит потоком Server-Sent Events.
import { apiUrl } from '../config';
import { ApiError, NetworkError } from './client';

export type ChatRole = 'user' | 'assistant';
export type ChatTurn = { role: ChatRole; text: string };
export type ChatSource = { id: number; title: string; heading: string | null };
export type ChatStatus = { enabled: boolean; maxQuestionLength: number };

export type ChatHandlers = {
  onSources(sources: ChatSource[]): void;
  onDelta(text: string): void;
  onDone(): void;
  onError(message: string): void;
};

export type SseEvent = { event: string; data: string };

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export async function getChatStatus(signal?: AbortSignal): Promise<ChatStatus> {
  let r: Response;
  try {
    // Чат открыт и без входа: cookie сессии ему не нужны
    r = await fetch(apiUrl('/public/chat/status'), {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new NetworkError();
  }
  if (!r.ok) throw new ApiError(r.status);
  return (await r.json()) as ChatStatus;
}

/**
 * Разбор потока SSE по кускам. Кусок из сети может оборваться посреди события или даже строки,
 * поэтому незаконченный хвост остаётся в буфере до следующего вызова push.
 * Событие заканчивается пустой строкой; строки data: внутри одного события склеиваются через \n.
 */
export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = '';
  let event = '';
  let data: string[] = [];

  const dispatch = () => {
    if (data.length) onEvent({ event: event || 'message', data: data.join('\n') });
    event = '';
    data = [];
  };

  const line = (raw: string) => {
    if (raw === '') return dispatch();
    if (raw.startsWith(':')) return; // комментарий (keep-alive)
    const colon = raw.indexOf(':');
    const field = colon === -1 ? raw : raw.slice(0, colon);
    let value = colon === -1 ? '' : raw.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  };

  return {
    push(chunk: string) {
      let text = buffer + chunk;
      // \r в самом конце может оказаться первой половиной \r\n: решаем, когда придёт следующий кусок
      const hold = text.endsWith('\r') ? '\r' : '';
      if (hold) text = text.slice(0, -1);
      // \r\n, \r и \n — все допустимые концы строки в SSE
      const lines = text.split(/\r\n|\r|\n/);
      buffer = (lines.pop() ?? '') + hold;
      for (const l of lines) line(l);
    },
    /** Конец потока: незавершённое последнее событие тоже отдаётся. */
    end() {
      const rest = buffer.replace(/\r$/, '');
      if (rest) line(rest);
      buffer = '';
      dispatch();
    },
  };
}

/** Текст ошибки из тела { error }; если тела нет — общий текст с кодом. */
async function errorText(r: Response): Promise<string> {
  let message = `Ошибка сервера (${r.status})`;
  try {
    const body = (await r.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) message = body.error;
  } catch {
    // не JSON
  }
  if (r.status === 429) {
    const wait = Number(r.headers.get('Retry-After'));
    if (Number.isFinite(wait) && wait > 0) message += ` Повторите через ${Math.ceil(wait)} с`;
  }
  return message;
}

/**
 * Задаёт вопрос и передаёт ответ по кускам в handlers. Ровно один из onDone/onError вызывается в конце,
 * кроме отмены через signal: тогда функция просто завершается.
 * EventSource не подходит: он умеет только GET, а вопрос и история уходят в теле POST.
 */
export async function streamChat(
  question: string,
  history: ChatTurn[],
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let finished = false;
  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    fn();
  };

  let r: Response;
  try {
    r = await fetch(apiUrl('/public/chat/stream'), {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ question, history }),
      signal,
    });
  } catch (e) {
    if (!isAbort(e)) handlers.onError('Нет связи с сервером');
    return;
  }

  if (!r.ok || !r.body) {
    const message = await errorText(r).catch(() => `Ошибка сервера (${r.status})`);
    if (!signal.aborted) handlers.onError(message);
    return;
  }

  const parser = createSseParser(({ event, data }) => {
    if (finished) return;
    try {
      switch (event) {
        case 'sources':
          handlers.onSources(JSON.parse(data) as ChatSource[]);
          break;
        case 'delta':
          handlers.onDelta((JSON.parse(data) as { text: string }).text ?? '');
          break;
        case 'done':
          finish(() => handlers.onDone());
          break;
        case 'error':
          finish(() => handlers.onError((JSON.parse(data) as { message?: string }).message || 'Ошибка ответа'));
          break;
      }
    } catch {
      finish(() => handlers.onError('Сервер прислал непонятный ответ'));
    }
  });

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (finished) break;
    }
    parser.push(decoder.decode());
    parser.end();
  } catch (e) {
    if (isAbort(e) || signal.aborted) return;
    finish(() => handlers.onError('Нет связи с сервером'));
    return;
  } finally {
    // Ответ закончен или прерван: соединение больше не нужно
    reader.cancel().catch(() => undefined);
  }
  if (!signal.aborted) finish(() => handlers.onError('Ответ прервался'));
}
