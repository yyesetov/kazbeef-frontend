import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, AuthError, NetworkError, errorMessage, get, login, resetCsrf, send } from './client';

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const empty = (status: number) => new Response(null, { status });
const csrf = (token: string) => json({ headerName: 'X-CSRF-TOKEN', token });

/** Заголовки n-го вызова fetch. */
const headersOf = (call: number) => fetchMock.mock.calls[call]?.[1]?.headers as Record<string, string>;
const urlOf = (call: number) => fetchMock.mock.calls[call]?.[0];

beforeEach(() => {
  resetCsrf();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('get', () => {
  it('возвращает разобранный JSON', async () => {
    fetchMock.mockResolvedValueOnce(json({ username: 'admin' }));
    await expect(get('/api/me')).resolves.toEqual({ username: 'admin' });
    expect(urlOf(0)).toBe('/api/me');
  });

  it('401 превращает в AuthError', async () => {
    fetchMock.mockResolvedValueOnce(empty(401));
    await expect(get('/api/me')).rejects.toBeInstanceOf(AuthError);
  });

  it('остальные ошибки сервера — ApiError с кодом', async () => {
    fetchMock.mockResolvedValueOnce(empty(503));
    await expect(get('/api/me')).rejects.toMatchObject({ name: 'ApiError', status: 503 });
  });

  it('сбой сети — NetworkError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(get('/api/me')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('send', () => {
  it('сначала получает CSRF-токен и передаёт его в заголовке', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t1')).mockResolvedValueOnce(json({ processed: 3 }));
    await expect(send('/admin/ai/run', 'POST')).resolves.toEqual({ processed: 3 });
    expect(urlOf(0)).toBe('/api/csrf');
    expect(headersOf(1)['X-CSRF-TOKEN']).toBe('t1');
  });

  it('токен запрашивается один раз на несколько запросов', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t1')).mockResolvedValueOnce(empty(204)).mockResolvedValueOnce(empty(204));
    await send('/a', 'POST');
    await send('/b', 'POST');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('при 403 берёт новый токен и повторяет запрос один раз', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf('old'))
      .mockResolvedValueOnce(empty(403))
      .mockResolvedValueOnce(csrf('new'))
      .mockResolvedValueOnce(empty(204));
    await expect(send('/a', 'POST')).resolves.toBeUndefined();
    expect(headersOf(3)['X-CSRF-TOKEN']).toBe('new');
  });

  it('повторный 403 — уже ошибка доступа, а не устаревший токен', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf('old'))
      .mockResolvedValueOnce(empty(403))
      .mockResolvedValueOnce(csrf('new'))
      .mockResolvedValueOnce(empty(403));
    await expect(send('/a', 'POST')).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('тело отправляет как JSON', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t')).mockResolvedValueOnce(empty(204));
    await send('/a', 'PUT', { nameEn: 'Anthrax' });
    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe('{"nameEn":"Anthrax"}');
    expect(headersOf(1)['Content-Type']).toBe('application/json');
  });
});

describe('login', () => {
  it('успех — true, форма уходит как urlencoded', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t')).mockResolvedValueOnce(empty(204));
    await expect(login('admin', 'secret')).resolves.toBe(true);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe('username=admin&password=secret');
    expect(headersOf(1)['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('неверный пароль — false, а не исключение', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t')).mockResolvedValueOnce(empty(401));
    await expect(login('admin', 'wrong')).resolves.toBe(false);
  });

  it('сбой сервера отличается от неверного пароля', async () => {
    fetchMock.mockResolvedValueOnce(csrf('t')).mockResolvedValueOnce(empty(500));
    await expect(login('admin', 'secret')).rejects.toBeInstanceOf(ApiError);
  });

  it('после входа токен сбрасывается: сессия сменилась', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf('before'))
      .mockResolvedValueOnce(empty(204))
      .mockResolvedValueOnce(csrf('after'))
      .mockResolvedValueOnce(empty(204));
    await login('admin', 'secret');
    await send('/a', 'POST');
    expect(headersOf(3)['X-CSRF-TOKEN']).toBe('after');
  });
});

describe('errorMessage', () => {
  it('показывает текст известных ошибок и общий текст для остальных', () => {
    expect(errorMessage(new NetworkError())).toBe('Нет связи с сервером');
    expect(errorMessage(new ApiError(500))).toBe('Ошибка сервера (500)');
    expect(errorMessage(new TypeError('x is undefined'))).toBe('Что-то пошло не так');
  });
});
