// Состояние диалога с помощником: сообщения, поток текущего ответа, восстановление после перезагрузки страницы.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChatStatus, queryKeys, streamChat, type ChatRole, type ChatSource, type ChatTurn } from '../../api';

export type ChatMessageStatus = 'streaming' | 'done' | 'error' | 'stopped';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  sources?: ChatSource[];
  status: ChatMessageStatus;
  error?: string;
  /** В базе знаний ничего не нашлось */
  notFound?: boolean;
};

const STORAGE_KEY = 'kazbeef-chat';
/** Сервер всё равно берёт не больше шести реплик. */
const HISTORY_LIMIT = 6;
/** Пока статус не загрузился, длину вопроса проверяем по пределу сервера по умолчанию. */
const DEFAULT_MAX_LENGTH = 1000;

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** sessionStorage может бросать исключение (приватный режим, запрет cookie): тогда диалог просто не сохраняется. */
function load(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Ответ, который шёл в момент перезагрузки, уже не допишется
    return (parsed as ChatMessage[])
      .filter((m) => m && typeof m.id === 'string' && typeof m.text === 'string')
      .map((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' } : m));
  } catch {
    return [];
  }
}

function save(messages: ChatMessage[]) {
  try {
    if (messages.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // нет хранилища — диалог живёт до перезагрузки
  }
}

/**
 * Контекст для следующего вопроса: только законченные пары «вопрос — ответ».
 * Вопрос, ответ на который прервался или не удался, без ответа модели только запутает.
 */
function historyOf(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i + 1 < messages.length; i++) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q?.role === 'user' && a?.role === 'assistant' && a.status === 'done' && !a.notFound) {
      turns.push({ role: 'user', text: q.text }, { role: 'assistant', text: a.text });
      i++;
    }
  }
  return turns.slice(-HISTORY_LIMIT);
}

export function useChat() {
  const status = useQuery({
    queryKey: queryKeys.chatStatus,
    queryFn: ({ signal }) => getChatStatus(signal),
    staleTime: 5 * 60_000,
  });
  const [messages, setMessages] = useState<ChatMessage[]>(load);
  const [isStreaming, setStreaming] = useState(false);

  // Последнее состояние для обработчиков: history и retry считаются по нему, а не по замыканию прошлого рендера
  const latest = useRef(messages);
  const controller = useRef<AbortController | null>(null);
  const answerId = useRef<string | null>(null);
  // Куски текста копятся здесь и попадают в состояние не чаще раза за кадр
  const pending = useRef('');
  const frame = useRef<number | null>(null);

  useEffect(() => {
    latest.current = messages;
    save(messages);
  }, [messages]);

  const patch = useCallback((id: string, change: (m: ChatMessage) => Partial<ChatMessage>) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...change(m) } : m)));
  }, []);

  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const text = pending.current;
    const id = answerId.current;
    pending.current = '';
    if (text && id) patch(id, (m) => ({ text: m.text + text }));
  }, [patch]);

  /** Заканчивает текущий ответ: после этого его обработчики уже ничего не меняют. */
  const finish = useCallback(
    (change: Partial<ChatMessage>) => {
      const id = answerId.current;
      flush();
      if (id) patch(id, () => change);
      controller.current = null;
      answerId.current = null;
      setStreaming(false);
    },
    [flush, patch],
  );

  const ask = useCallback(
    (question: string, before: ChatMessage[]) => {
      const user: ChatMessage = { id: newId(), role: 'user', text: question, status: 'done' };
      const answer: ChatMessage = { id: newId(), role: 'assistant', text: '', status: 'streaming' };
      const history = historyOf(before);
      setMessages([...before, user, answer]);

      const ac = new AbortController();
      controller.current = ac;
      answerId.current = answer.id;
      pending.current = '';
      setStreaming(true);

      // После stop() или reset() поток может ещё успеть прислать разобранные куски: они игнорируются
      const live = () => controller.current === ac && !ac.signal.aborted;
      void streamChat(
        question,
        history,
        {
          onSources: (sources) => {
            if (live()) patch(answer.id, () => ({ sources, notFound: sources.length === 0 }));
          },
          onDelta: (text) => {
            if (!live()) return;
            pending.current += text;
            frame.current ??= requestAnimationFrame(() => {
              frame.current = null;
              flush();
            });
          },
          onDone: () => {
            if (live()) finish({ status: 'done' });
          },
          onError: (error) => {
            if (live()) finish({ status: 'error', error });
          },
        },
        ac.signal,
      );
    },
    [finish, flush, patch],
  );

  const maxLength = status.data?.maxQuestionLength ?? DEFAULT_MAX_LENGTH;

  /** true — вопрос ушёл; false — пустой, слишком длинный или ещё идёт прошлый ответ. */
  const send = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || q.length > maxLength || controller.current) return false;
      ask(q, latest.current);
      return true;
    },
    [ask, maxLength],
  );

  const stop = useCallback(() => {
    const ac = controller.current;
    if (!ac) return;
    finish({ status: 'stopped' });
    ac.abort();
  }, [finish]);

  /** Повторяет последний вопрос: неудачный ответ и сам вопрос уходят из ленты и добавляются заново. */
  const retry = useCallback(() => {
    if (controller.current) return;
    const ms = latest.current;
    let i = ms.length - 1;
    while (i >= 0 && ms[i]?.role !== 'user') i--;
    const question = ms[i];
    if (question) ask(question.text, ms.slice(0, i));
  }, [ask]);

  const reset = useCallback(() => {
    const ac = controller.current;
    controller.current = null;
    answerId.current = null;
    pending.current = '';
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    ac?.abort();
    setStreaming(false);
    setMessages([]);
  }, []);

  // Ушли со страницы или закрыли компонент: поток и кадр больше не нужны
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  return { messages, isStreaming, status, maxLength, send, stop, retry, reset };
}

export type ChatApi = ReturnType<typeof useChat>;
