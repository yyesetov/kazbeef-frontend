// Ключи кеша и общие запросы. Ключи собраны в одном месте, чтобы инвалидация не зависела от опечаток.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFilters } from '../filters/useFilters';
import { AuthError, get } from './client';
import type { Me, Reference } from './types';

export const queryKeys = {
  me: ['me'] as const,
  reference: ['reference'] as const,
  slice: (path: string, query: string, extra: string) => ['slice', path, query, extra] as const,
  event: (id: number | null) => ['event', id] as const,
  geo: (name: string) => ['geo', name] as const,
  collectors: ['admin', 'collectors'] as const,
  system: ['admin', 'system'] as const,
  adminDiseases: ['admin', 'diseases'] as const,
};

/** Текущий пользователь; null — не вошёл. Остальные сбои (сеть, 5xx) остаются ошибкой запроса. */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await get<Me>('/api/me', signal);
      } catch (e) {
        if (e instanceof AuthError) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useReference() {
  return useQuery({
    queryKey: queryKeys.reference,
    queryFn: ({ signal }) => get<Reference>('/api/reference', signal),
    staleTime: 60_000,
  });
}

/** Чтение по текущему срезу фильтров. Прошлые данные остаются на экране, пока грузятся новые. */
export function useSlice<T>(path: string, extra = '') {
  const { query } = useFilters();
  return useQuery({
    queryKey: queryKeys.slice(path, query, extra),
    queryFn: ({ signal }) => get<T>(`${path}?${query}${extra ? `&${extra}` : ''}`, signal),
    placeholderData: keepPreviousData,
  });
}
