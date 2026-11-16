import { Center, Loader } from '@mantine/core';
import { useMe } from './api';
import { ErrorState } from './components/states';
import { FiltersProvider } from './filters/FiltersProvider';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';

/** Три состояния сеанса: неизвестно (загрузка или сбой), не вошёл, вошёл. */
export function App() {
  const me = useMe();

  if (me.isPending) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }
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
  if (!me.data) return <LoginPage />;

  return (
    <FiltersProvider>
      <AppLayout me={me.data} />
    </FiltersProvider>
  );
}
