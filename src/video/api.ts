// Единственная точка, откуда страница берёт данные видеомониторинга.
// Сейчас — демо-данные; когда бэкенд будет готов, здесь появятся get('/api/video/overview') и разметка через send.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demoOverview } from './demo';
import type { Review, VideoOverview } from './types';

export const videoKeys = { overview: ['video', 'overview'] as const };

/** Как часто обновлять журнал и состояние камер, когда появится реальный поток событий. */
const POLL_MS = 15_000;

export function useVideoOverview() {
  return useQuery({
    queryKey: videoKeys.overview,
    queryFn: () => Promise.resolve(demoOverview()),
    // демо-данные не меняются: опрашивать нечего
    staleTime: Infinity,
    refetchInterval: (q) => (q.state.data?.demo ? false : POLL_MS),
  });
}

/** Разметка события: «подтверждено» или «ложное срабатывание». На ней ИИ будет дообучаться. */
export function useReviewEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: Review }) => Promise.resolve({ id, review }),
    onSuccess: ({ id, review }) =>
      qc.setQueryData<VideoOverview>(videoKeys.overview, (o) =>
        o ? { ...o, events: o.events.map((e) => (e.id === id ? { ...e, review } : e)) } : o,
      ),
  });
}
