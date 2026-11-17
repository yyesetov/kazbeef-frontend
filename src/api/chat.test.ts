import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSseParser, streamChat, type ChatHandlers, type SseEvent } from './chat';

const parse = (chunks: string[]) => {
  const events: SseEvent[] = [];
  const p = createSseParser((e) => events.push(e));
  for (const c of chunks) p.push(c);
  p.end();
  return events;
};

describe('createSseParser', () => {
  it('разбирает события, разделённые пустой строкой', () => {
    expect(parse(['event:sources\ndata:[]\n\nevent:delta\ndata:{"text":"a"}\n\n'])).toEqual([
      { event: 'sources', data: '[]' },
      { event: 'delta', data: '{"text":"a"}' },
    ]);
  });

  it('собирает событие, разрезанное на два куска', () => {
    expect(parse(['event:del', 'ta\ndata:{"te', 'xt":"привет"}\n', '\n'])).toEqual([
      { event: 'delta', data: '{"text":"привет"}' },
    ]);
  });

  it('склеивает несколько строк data через перевод строки и снимает пробел после двоеточия', () => {
    expect(parse(['event: delta\ndata: a\ndata: b\n\n'])).toEqual([{ event: 'delta', data: 'a\nb' }]);
  });

  it('понимает \\r\\n, даже если он разрезан между кусками', () => {
    expect(parse(['event:done\r', '\ndata:{}\r\n\r', '\n'])).toEqual([{ event: 'done', data: '{}' }]);
  });

  it('пропускает комментарии и отдаёт последнее событие без пустой строки в конце', () => {
    expect(parse([': ping\n\nevent:done\ndata:{}'])).toEqual([{ event: 'done', data: '{}' }]);
  });
});

describe('streamChat', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const handlers = () =>
    ({
      onSources: vi.fn<ChatHandlers['onSources']>(),
      onDelta: vi.fn<ChatHandlers['onDelta']>(),
      onDone: vi.fn<ChatHandlers['onDone']>(),
      onError: vi.fn<ChatHandlers['onError']>(),
    }) satisfies ChatHandlers;

  const stream = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
          c.close();
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );

  it('передаёт источники, куски текста и завершение', async () => {
    fetchMock.mockResolvedValueOnce(
      stream([
        'event:sources\ndata:[{"id":1,"title":"Т","heading":null}]\n\n',
        'event:delta\ndata:{"text":"Для "}\n\nevent:delta\ndata:{"text":"дезинфекции"}\n\n',
        'event:done\ndata:{}\n\n',
      ]),
    );
    const h = handlers();
    await streamChat('вопрос', [], h, new AbortController().signal);
    expect(h.onSources).toHaveBeenCalledWith([{ id: 1, title: 'Т', heading: null }]);
    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(['Для ', 'дезинфекции']);
    expect(h.onDone).toHaveBeenCalledOnce();
    expect(h.onError).not.toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
    expect(init?.body).toBe('{"question":"вопрос","history":[]}');
  });

  it('поток без done — ошибка «Ответ прервался»', async () => {
    fetchMock.mockResolvedValueOnce(stream(['event:delta\ndata:{"text":"a"}\n\n']));
    const h = handlers();
    await streamChat('q', [], h, new AbortController().signal);
    expect(h.onError).toHaveBeenCalledWith('Ответ прервался');
  });

  it('429 — текст сервера и сколько ждать', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Слишком много вопросов подряд.' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      }),
    );
    const h = handlers();
    await streamChat('q', [], h, new AbortController().signal);
    expect(h.onError).toHaveBeenCalledWith('Слишком много вопросов подряд. Повторите через 30 с');
  });

  it('отмена — не ошибка', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    const h = handlers();
    await streamChat('q', [], h, new AbortController().signal);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('сбой сети — «Нет связи с сервером»', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const h = handlers();
    await streamChat('q', [], h, new AbortController().signal);
    expect(h.onError).toHaveBeenCalledWith('Нет связи с сервером');
  });
});
