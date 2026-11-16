import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, AuthError } from './client';
import { queryKeys } from './queries';

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // Сессия истекла посреди работы: любой запрос с 401 возвращает приложение на экран входа
    onError: (error) => {
      if (error instanceof AuthError) queryClient.setQueryData(queryKeys.me, null);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Повторяем один раз и только то, что может пройти со второй попытки: сеть и 5xx, но не 4xx
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
});
