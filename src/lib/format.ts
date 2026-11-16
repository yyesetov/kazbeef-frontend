/** Число с разделителями разрядов; пустое значение — тире. */
export const fmt = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('ru-RU');

/** YYYY-MM-DD (или ISO-дата со временем) → ДД.ММ.ГГГГ. */
export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

/** Момент времени в часовом поясе пользователя: ДД.ММ.ГГГГ, ЧЧ:ММ. */
export const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Разбирает JSON-массив, пришедший строкой. Битые данные дают пустой массив, а не падение страницы. */
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}
