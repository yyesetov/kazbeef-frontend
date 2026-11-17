import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Loader, Center, Tooltip, Transition } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { ChatAiIcon } from './ChatAiIcon';

// Сама панель (и react-markdown вместе с ней) грузится только когда чат открывают впервые
const loadPanel = () => import('./ChatPanel');
const ChatPanel = lazy(() => loadPanel().then((m) => ({ default: m.ChatPanel })));

const OPEN_KEY = 'kazbeef-chat-open';

function readOpen() {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOpen(open: boolean) {
  try {
    if (open) sessionStorage.setItem(OPEN_KEY, '1');
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // без хранилища панель просто не вспомнит, что была открыта
  }
}

/** Плавающая кнопка чата в правом нижнем углу и всплывающая панель над ней (на узком экране — во весь экран). */
export function ChatWidget() {
  const [open, setOpen] = useState(readOpen);
  // Панель, открытая хоть раз, остаётся смонтированной: ответ, который печатается, не обрывается при закрытии
  const [mounted, setMounted] = useState(open);
  const fab = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    writeOpen(false);
    fab.current?.focus();
  }, []);

  const toggle = () => {
    if (open) return close();
    setMounted(true);
    setOpen(true);
    writeOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const focusInput = () => popup.current?.querySelector('textarea')?.focus();

  return (
    <>
      {mounted && (
        <Transition mounted={open} transition="pop-bottom-right" duration={160} keepMounted onEntered={focusInput}>
          {(style) => (
            <div ref={popup} className="kb-chat-popup" style={style} role="dialog" aria-label="Помощник по базе знаний">
              <Suspense
                fallback={
                  <Center h="100%" bg="var(--kb-surface)">
                    <Loader size="sm" />
                  </Center>
                }
              >
                <ChatPanel
                  autoFocus
                  headerExtra={
                    <Tooltip label="Закрыть">
                      <ActionIcon variant="subtle" color="gray" aria-label="Закрыть чат" onClick={close}>
                        <IconX size={18} />
                      </ActionIcon>
                    </Tooltip>
                  }
                />
              </Suspense>
            </div>
          )}
        </Transition>
      )}
      <ActionIcon
        ref={fab}
        className="kb-chat-fab"
        size={56}
        radius="xl"
        variant="filled"
        aria-label={open ? 'Закрыть чат' : 'Задать вопрос'}
        aria-expanded={open}
        onClick={toggle}
        // Наводят — значит, скорее всего откроют: панель начинает грузиться заранее
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
      >
        {open ? <IconX size={24} /> : <ChatAiIcon size={30} stroke={1.5} />}
      </ActionIcon>
    </>
  );
}
