import { Suspense, lazy } from 'react';
import { Center, Loader } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { useMe } from './api';
import { ChatWidget } from './components/chat/ChatWidget';
import { ErrorState } from './components/states';
import { FiltersProvider } from './filters/FiltersProvider';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';

const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));

const FullScreenLoader = () => (
  <Center mih="100dvh">
    <Loader />
  </Center>
);

/** Публичный чат открывается без входа: для него сеанс не проверяется вовсе. */
export function App() {
  const { pathname } = useLocation();
  if (pathname.replace(/\/+$/, '') === '/chat') {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <ChatPage />
      </Suspense>
    );
  }
  return <Session />;
}

/** Три состояния сеанса: неизвестно (загрузка или сбой), не вошёл, вошёл. */
function Session() {
  const me = useMe();

  if (me.isPending) return <FullScreenLoader />;
  // Сервер недоступен — это не «не вошёл»: показываем причину, а не форму входа.
  // Сбой фоновой перепроверки при уже известном пользователе работу не прерывает.
  if (me.data === undefined) {
    return (
      <Center mih="100dvh" p="md">
        <div style={{ width: '100%', maxWidth: 420 }}>
          <ErrorState error={me.error} onRetry={() => void me.refetch()} />
        </div>
      </Center>
    );
  }
  if (!me.data) {
    return (
      <>
        <LoginPage />
        <ChatWidget />
      </>
    );
  }

  return (
    <FiltersProvider>
      <AppLayout me={me.data} />
      <ChatWidget />
    </FiltersProvider>
  );
}
