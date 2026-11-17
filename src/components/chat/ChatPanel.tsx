import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ActionIcon, Alert, Badge, Button, Group, ScrollArea, Text, Textarea, Tooltip } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconMessagePlus,
  IconPlayerStopFilled,
  IconRefresh,
  IconSearchOff,
  IconSend2,
} from '@tabler/icons-react';
import type { ChatSource } from '../../api';
import { Markdown } from '../markdown/Markdown';
import { ChatAiIcon } from './ChatAiIcon';
import { useChat, type ChatMessage } from './useChat';

const EXAMPLES = [
  'Какие СИЗ нужны при дезинфекции?',
  'Что делать при травме от животного?',
  'Как подготовить помещение к дезинфекции?',
  'Кто допускается к работе с КРС?',
];

/** Счётчик символов появляется, когда до предела осталось меньше этого числа. */
const COUNTER_THRESHOLD = 100;
/** Насколько можно не дойти до низа ленты, чтобы всё ещё считаться «внизу». */
const BOTTOM_SLACK = 48;

/** Один документ может найтись несколькими разделами: показываем его один раз, разделы — в подсказке. */
function groupSources(sources: ChatSource[]) {
  const byId = new Map<number, { id: number; title: string; headings: string[] }>();
  for (const s of sources) {
    const g = byId.get(s.id) ?? { id: s.id, title: s.title, headings: [] };
    if (s.heading && !g.headings.includes(s.heading)) g.headings.push(s.heading);
    byId.set(s.id, g);
  }
  return [...byId.values()];
}

function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="kb-chat-sources">
      <span className="kb-chat-sources-label">Источники:</span>
      {groupSources(sources).map((s) => {
        const badge = (
          <Badge
            variant="light"
            color="gray"
            size="sm"
            className="kb-chat-source"
            tabIndex={s.headings.length ? 0 : -1}
          >
            {s.title}
          </Badge>
        );
        return s.headings.length ? (
          <Tooltip key={s.id} label={s.headings.join('; ')} multiline maw={280} withinPortal>
            {badge}
          </Tooltip>
        ) : (
          <span key={s.id}>{badge}</span>
        );
      })}
    </div>
  );
}

const Thinking = () => (
  <div className="kb-chat-thinking" role="status">
    <span>Ищу в базе знаний</span>
    <span className="kb-chat-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  </div>
);

/** Сообщение перерисовывается, только когда меняется оно само: при потоке обновляется один последний ответ. */
const Message = memo(function Message({ message: m, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  if (m.role === 'user') {
    return (
      <div className="kb-chat-row user">
        <div className="kb-chat-bubble user">{m.text}</div>
      </div>
    );
  }

  const streaming = m.status === 'streaming';
  return (
    <div className="kb-chat-row assistant">
      <div className={`kb-chat-bubble assistant${m.notFound ? ' not-found' : ''}`}>
        {streaming && !m.text ? (
          <Thinking />
        ) : (
          <Group gap={8} align="flex-start" wrap="nowrap">
            {m.notFound && <IconSearchOff size={18} className="kb-chat-notfound-icon" aria-label="Ничего не найдено" />}
            <Markdown className={streaming ? 'kb-md-streaming' : undefined}>{m.text}</Markdown>
          </Group>
        )}
        {m.status === 'error' && (
          <Group gap={8} mt={m.text ? 8 : 0} wrap="nowrap" align="center">
            <Text size="sm" c="red" style={{ flex: 1 }}>
              {m.error ?? 'Не удалось получить ответ'}
            </Text>
            <Button size="compact-xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
              Повторить
            </Button>
          </Group>
        )}
        {m.status === 'stopped' && <div className="kb-chat-note">Ответ остановлен</div>}
        {!!m.sources?.length && <Sources sources={m.sources} />}
      </div>
    </div>
  );
});

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="kb-chat-empty">
      <Text size="sm" c="dimmed">
        Задайте вопрос — отвечу по инструкциям и документам KazBeef.
      </Text>
      <div className="kb-chat-examples">
        {EXAMPLES.map((q) => (
          <button key={q} type="button" className="kb-chat-example" onClick={() => onPick(q)} disabled={disabled}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export type ChatPanelProps = {
  /** Фокус в поле ввода сразу после появления панели */
  autoFocus?: boolean;
  /** Дополнительные кнопки в шапке справа (например, «Закрыть» во всплывающей панели) */
  headerExtra?: ReactNode;
};

/** Окно чата. Размер задаёт родитель: панель растягивается на всю высоту контейнера. */
export function ChatPanel({ autoFocus, headerExtra }: ChatPanelProps) {
  const { messages, isStreaming, status, maxLength, send, stop, retry, reset } = useChat();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const unavailable = status.data?.enabled === false;
  const remaining = maxLength - draft.length;
  const tooLong = remaining < 0;
  const canSend = !unavailable && !isStreaming && !!draft.trim() && !tooLong;

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const v = viewport.current;
    if (!v) return;
    v.scrollTo({ top: v.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottom.current = true;
    setShowJump(false);
  }, []);

  // Новые куски ответа подтягивают ленту вниз, только если пользователь и так был внизу
  useEffect(() => {
    if (atBottom.current) scrollToBottom(false);
    else setShowJump(true);
  }, [messages, scrollToBottom]);

  const onScroll = () => {
    const v = viewport.current;
    if (!v) return;
    const bottom = v.scrollHeight - v.scrollTop - v.clientHeight <= BOTTOM_SLACK;
    atBottom.current = bottom;
    if (bottom) setShowJump(false);
  };

  const submit = (question: string) => {
    if (send(question)) {
      if (question === draft) setDraft('');
      // Только что отправленный вопрос всегда должен быть виден
      atBottom.current = true;
    }
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter отправляет, Shift+Enter — новая строка. Во время набора через IME Enter подтверждает слово
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) submit(draft);
    }
  };

  return (
    <section className="kb-chat" aria-label="Помощник по базе знаний">
      <header className="kb-chat-header">
        <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
          <span className="kb-chat-avatar">
            <ChatAiIcon size={22} stroke={1.5} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="kb-chat-title">Помощник по базе знаний</div>
            <div className="kb-chat-subtitle">Отвечает ИИ только по документам базы знаний</div>
          </div>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Новый диалог">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Новый диалог"
              onClick={() => {
                reset();
                setDraft('');
                input.current?.focus();
              }}
              disabled={!messages.length}
            >
              <IconMessagePlus size={18} />
            </ActionIcon>
          </Tooltip>
          {headerExtra}
        </Group>
      </header>

      <div className="kb-chat-body">
        <ScrollArea
          h="100%"
          viewportRef={viewport}
          onScrollPositionChange={onScroll}
          type="auto"
          offsetScrollbars
          scrollbarSize={8}
        >
          <div className="kb-chat-log" role="log" aria-live="polite" aria-busy={isStreaming} aria-label="Диалог">
            {messages.length === 0 ? (
              <EmptyState onPick={submit} disabled={unavailable || isStreaming} />
            ) : (
              messages.map((m) => <Message key={m.id} message={m} onRetry={retry} />)
            )}
          </div>
        </ScrollArea>
        {showJump && (
          <Button
            className="kb-chat-jump"
            size="compact-sm"
            radius="xl"
            variant="default"
            leftSection={<IconArrowDown size={14} />}
            onClick={() => scrollToBottom(true)}
          >
            К последнему сообщению
          </Button>
        )}
      </div>

      <footer className="kb-chat-footer">
        {unavailable && (
          <Alert color="yellow" variant="light" p={8} mb={8} icon={<IconAlertTriangle size={16} />}>
            Чат временно недоступен
          </Alert>
        )}
        <form
          className="kb-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isStreaming) stop();
            else if (canSend) submit(draft);
          }}
        >
          <Textarea
            ref={input}
            className="kb-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            placeholder="Ваш вопрос…"
            aria-label="Ваш вопрос"
            autosize
            minRows={1}
            maxRows={5}
            disabled={unavailable}
            error={tooLong || undefined}
          />
          {isStreaming ? (
            <Tooltip label="Остановить">
              <ActionIcon type="submit" size={36} variant="default" aria-label="Остановить ответ">
                <IconPlayerStopFilled size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Отправить">
              <ActionIcon type="submit" size={36} variant="filled" aria-label="Отправить вопрос" disabled={!canSend}>
                <IconSend2 size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </form>
        {remaining < COUNTER_THRESHOLD && (
          <div className={`kb-chat-counter${tooLong ? ' over' : ''}`} aria-live="polite">
            {tooLong ? `Длиннее предела на ${-remaining}` : `Осталось символов: ${remaining}`}
          </div>
        )}
      </footer>
    </section>
  );
}
