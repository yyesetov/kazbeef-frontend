/** Число с разделителями разрядов; пустое значение — тире. */
export const fmt = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('ru-RU');

/** YYYY-MM-DD (или ISO-дата со временем) → ДД.ММ.ГГГГ. */
export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

/**
 * Момент времени от сервера как Date. Кроме ISO принимает вид PostgreSQL «2026-11-17 06:35:56+00»:
 * его понимает не каждый браузер, поэтому пробел меняется на T, а смещение дополняется минутами.
 */
export const parseInstant = (s: string) =>
  new Date(
    s
      .trim()
      .replace(' ', 'T')
      .replace(/(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?[+-]\d{2})$/, '$1:00'),
  );

/** Момент времени в часовом поясе пользователя: ДД.ММ.ГГГГ, ЧЧ:ММ. */
export const fmtDateTime = (s?: string | null) =>
  s
    ? parseInstant(s).toLocaleString('ru-RU', {
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

/** Размер файла по-русски: 512 Б, 2,6 КБ, 14,1 МБ. */
export function fmtSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[i]}`;
}
