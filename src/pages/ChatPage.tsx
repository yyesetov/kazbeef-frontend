import { Group } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ChatPanel } from '../components/chat/ChatPanel';
import { assetUrl } from '../config';

/** Публичная страница чата: открывается без входа, её можно давать ссылкой посетителям. */
export function ChatPage() {
  return (
    <div className="kb-chat-page">
      <header className="kb-chat-page-bar">
        <Group gap={10} wrap="nowrap">
          <img className="kb-topbar-mark" src={assetUrl('mark.svg')} alt="" />
          <span className="kb-topbar-name">KazBeef</span>
        </Group>
        <Link to="/">Войти</Link>
      </header>
      <main className="kb-chat-page-main">
        <ChatPanel autoFocus />
      </main>
    </div>
  );
}
