import type { Interval, Metric } from '../api';

export const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
];

export const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: 'events', label: 'События' },
  { value: 'outbreaks', label: 'Очаги' },
  { value: 'cases', label: 'Случаи' },
];

/** Родительный падеж множественного числа: «12 очагов», «больше случаев». */
export const METRIC_UNIT: Record<Metric, string> = { events: 'событий', outbreaks: 'очагов', cases: 'случаев' };
