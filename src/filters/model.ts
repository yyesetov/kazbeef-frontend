// Модель фильтров без React: разбор адресной строки, сборка обратно и запрос к API.
import dayjs from 'dayjs';

export const PERIODS = ['30', '90', '365', 'all', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

export type Filters = {
  countries: string[];
  diseases: string[];
  groups: string[];
  sources: string[];
  status: string[];
  period: Period;
  /** Границы произвольного периода, YYYY-MM-DD. Учитываются только при period = 'custom'. */
  from: string | null;
  to: string | null;
  ruminantOnly: boolean;
  q: string;
};

export const DEFAULT_FILTERS: Filters = {
  countries: [],
  diseases: [],
  groups: [],
  sources: [],
  status: [],
  period: '365',
  from: null,
  to: null,
  ruminantOnly: true,
  q: '',
};

const LIST_KEYS = ['countries', 'diseases', 'groups', 'sources', 'status'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FORMAT = 'YYYY-MM-DD';

const isPeriod = (v: string | null): v is Period => PERIODS.includes(v as Period);

/** Адресная строка страницы → фильтры. Неизвестные и испорченные значения заменяются значениями по умолчанию. */
export function parseFilters(search: URLSearchParams): Filters {
  const date = (key: string) => {
    const v = search.get(key);
    return v && ISO_DATE.test(v) ? v : null;
  };
  const period = search.get('period');
  return {
    countries: search.getAll('countries'),
    diseases: search.getAll('diseases'),
    groups: search.getAll('groups'),
    sources: search.getAll('sources'),
    status: search.getAll('status'),
    period: isPeriod(period) ? period : DEFAULT_FILTERS.period,
    from: date('from'),
    to: date('to'),
    ruminantOnly: search.get('all') !== '1',
    q: search.get('q') ?? '',
  };
}

/** Фильтры → адресная строка страницы. Значения по умолчанию не пишутся, чтобы ссылка оставалась короткой. */
export function filtersToSearch(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of LIST_KEYS) f[key].forEach((v) => p.append(key, v));
  if (f.period !== DEFAULT_FILTERS.period) p.set('period', f.period);
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
  }
  if (!f.ruminantOnly) p.set('all', '1');
  if (f.q.trim()) p.set('q', f.q.trim());
  return p;
}

/** Фильтры → параметры запроса к API. Относительный период («30 дней») отсчитывается от today. */
export function toApiQuery(f: Filters, today: Date = new Date()): string {
  const p = new URLSearchParams();
  for (const key of LIST_KEYS) f[key].forEach((v) => p.append(key, v));
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
  } else if (f.period !== 'all') {
    p.set('from', dayjs(today).subtract(Number(f.period), 'day').format(DATE_FORMAT));
  }
  p.set('ruminantOnly', String(f.ruminantOnly));
  if (f.q.trim()) p.set('q', f.q.trim());
  return p.toString();
}

export const toIsoDate = (d: Date | null) => (d ? dayjs(d).format(DATE_FORMAT) : null);
/** Дата без времени разбирается как локальная полночь, а не UTC: календарь показывает тот же день. */
export const fromIsoDate = (s: string | null) => (s ? dayjs(s).toDate() : null);
