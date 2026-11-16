// Подготовка временных рядов для графика. Без React и без библиотеки графиков — проверяется тестами.
import type { Interval, SeriesRow } from '../api';

const MAX_PERIODS = 600;
const toUtcDate = (period: string) => new Date(`${period}T00:00:00Z`);

/** Заполняет пропущенные периоды, чтобы ось времени была равномерной. На входе отсортированные YYYY-MM-DD. */
export function fillPeriods(periods: string[], interval: Interval): string[] {
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (first === undefined || last === undefined || periods.length < 2) return periods;
  const out: string[] = [];
  const d = toUtcDate(first);
  const end = toUtcDate(last);
  while (d <= end && out.length < MAX_PERIODS) {
    out.push(d.toISOString().slice(0, 10));
    if (interval === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Подпись периода на оси: «мар 25» для месяцев, «03 мар» для недель. */
export function periodLabel(period: string, interval: Interval): string {
  const [y = '', m = '', d = ''] = period.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  return interval === 'month' ? `${month} ${y.slice(2)}` : `${d} ${month}`;
}

export type StackedSeries = {
  name: string;
  /** Номер цвета в палитре; null — сборный ряд «Прочие» */
  slot: number | null;
  data: number[];
};

export const OTHER_SERIES = 'Прочие';

/**
 * Раскладывает строки «период × сущность» в ряды для столбцов с накоплением.
 * Сущности со слотом получают свой ряд, остальные складываются в «Прочие» (он всегда последний).
 */
export function stackSeries(
  rows: SeriesRow[],
  slots: ReadonlyMap<string, number>,
  metric: 'events' | 'outbreaks' | 'cases' | 'deaths',
  interval: Interval,
): { periods: string[]; series: StackedSeries[] } {
  const periods = fillPeriods([...new Set(rows.map((r) => r.period))].sort(), interval);
  const index = new Map(periods.map((p, i) => [p, i]));
  const byId = new Map<string, StackedSeries>();

  for (const r of rows) {
    const slot = slots.get(r.key) ?? null;
    const id = slot === null ? '__other' : r.key;
    let s = byId.get(id);
    if (!s) {
      s = { name: slot === null ? OTHER_SERIES : r.label, slot, data: periods.map(() => 0) };
      byId.set(id, s);
    }
    const i = index.get(r.period);
    if (i !== undefined) s.data[i] = (s.data[i] ?? 0) + (Number(r[metric]) || 0);
  }

  const order = (s: StackedSeries) => s.slot ?? Number.POSITIVE_INFINITY;
  return { periods, series: [...byId.values()].sort((a, b) => order(a) - order(b)) };
}
