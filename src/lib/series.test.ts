import { describe, expect, it } from 'vitest';
import type { SeriesRow } from '../api';
import { OTHER_SERIES, fillPeriods, periodLabel, stackSeries } from './series';

const row = (period: string, key: string, events: number, label = key): SeriesRow => ({
  period,
  key,
  label,
  events,
  outbreaks: events * 2,
  cases: 0,
  deaths: 0,
});

describe('fillPeriods', () => {
  it('заполняет пропущенные недели', () => {
    expect(fillPeriods(['2026-01-05', '2026-01-26'], 'week')).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ]);
  });

  it('заполняет пропущенные месяцы, в том числе через границу года', () => {
    expect(fillPeriods(['2025-11-01', '2026-02-01'], 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });

  it('один период или пустой список возвращает как есть', () => {
    expect(fillPeriods([], 'week')).toEqual([]);
    expect(fillPeriods(['2026-01-05'], 'week')).toEqual(['2026-01-05']);
  });
});

describe('periodLabel', () => {
  it('подписывает месяц с годом, а неделю — днём и месяцем', () => {
    expect(periodLabel('2026-03-01', 'month')).toBe('мар 26');
    expect(periodLabel('2026-03-09', 'week')).toBe('09 мар');
  });
});

describe('stackSeries', () => {
  const slots = new Map([
    ['A', 0],
    ['B', 1],
  ]);

  it('раскладывает строки по рядам в порядке слотов и ставит нули в пропуски', () => {
    const { periods, series } = stackSeries(
      [row('2026-01-05', 'B', 3), row('2026-01-19', 'A', 5), row('2026-01-19', 'B', 1)],
      slots,
      'events',
      'week',
    );
    expect(periods).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
    expect(series).toEqual([
      { name: 'A', slot: 0, data: [0, 0, 5] },
      { name: 'B', slot: 1, data: [3, 0, 1] },
    ]);
  });

  it('сущности без слота складывает в «Прочие» последним рядом', () => {
    const { series } = stackSeries(
      [row('2026-01-05', 'X', 2), row('2026-01-05', 'Y', 4), row('2026-01-05', 'A', 1)],
      slots,
      'events',
      'week',
    );
    expect(series.map((s) => s.name)).toEqual(['A', OTHER_SERIES]);
    expect(series[1]).toEqual({ name: OTHER_SERIES, slot: null, data: [6] });
  });

  it('считает выбранный показатель', () => {
    const { series } = stackSeries([row('2026-01-05', 'A', 3)], slots, 'outbreaks', 'week');
    expect(series[0]?.data).toEqual([6]);
  });

  it('пустой вход даёт пустой график', () => {
    expect(stackSeries([], slots, 'events', 'week')).toEqual({ periods: [], series: [] });
  });
});
