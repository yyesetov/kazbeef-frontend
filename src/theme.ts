import { useMemo } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import type { EventStatus, Reference, SpeciesGroup, TrustLevel } from './api';

// Категориальная палитра: порядок слотов фиксирован (он обеспечивает различимость при дальтонизме).
const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
};
const OTHER = { light: '#b5b3ac', dark: '#5f5e5a' };

// Последовательная шкала (один оттенок, светлее → темнее)
const SEQUENTIAL = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

type RiskLevel = { label: string; color: string };

// Статусные цвета: только для уровня риска, всегда с подписью
export const RISK_LEVELS: (RiskLevel & { min: number })[] = [
  { min: 75, label: 'Критический', color: '#d03b3b' },
  { min: 50, label: 'Высокий', color: '#ec835a' },
  { min: 25, label: 'Средний', color: '#fab219' },
  { min: 0, label: 'Низкий', color: '#0ca30c' },
];
export const NO_RISK: RiskLevel = { label: 'Не оценён', color: '#898781' };

export function riskLevel(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined) return NO_RISK;
  return RISK_LEVELS.find((l) => score >= l.min) ?? NO_RISK;
}

export type ChartTheme = {
  dark: boolean;
  series: string[];
  other: string;
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
};

/** Цвета графиков для текущей схемы. Объект стабилен, пока схема не сменилась, — его можно класть в зависимости. */
export function useChartTheme(): ChartTheme {
  const dark = useComputedColorScheme('light') === 'dark';
  return useMemo(
    () => ({
      dark,
      series: dark ? CATEGORICAL.dark : CATEGORICAL.light,
      other: dark ? OTHER.dark : OTHER.light,
      // Те же значения, что у токенов --kb-* в styles.css: графику на canvas нужны числа, а не CSS-переменные
      surface: dark ? '#211e1d' : '#ffffff',
      ink: dark ? '#f2eeea' : '#1f1b1a',
      ink2: dark ? '#c7c0b9' : '#5a5450',
      muted: dark ? '#9a938c' : '#756e68',
      grid: dark ? '#322e2c' : '#e9e5e0',
      axis: dark ? '#403b38' : '#d0cac3',
    }),
    [dark],
  );
}

/** Цвет ячейки тепловой таблицы и цвет текста на ней. */
export function heatColor(value: number, max: number): { background: string; color: string } {
  if (!value || max <= 0) return { background: 'transparent', color: 'inherit' };
  const last = SEQUENTIAL.length - 1;
  const i = Math.min(last, Math.max(0, Math.floor((value / max) * last + 0.5)));
  return { background: SEQUENTIAL[i] ?? 'transparent', color: i >= 3 ? '#ffffff' : '#1f1b1a' };
}

export const MAX_SERIES = CATEGORICAL.light.length;

/** Соответствие «ключ сущности → номер цвета в палитре». */
export type Slots = ReadonlyMap<string, number>;

/**
 * Закрепляет цвет за сущностью, а не за местом в текущей выборке: слоты раздаются по полному
 * справочнику, поэтому фильтр не перекрашивает оставшиеся ряды. Всё, что не вошло, уходит в «Прочие».
 */
export function slotMap(orderedKeys: string[]): Slots {
  return new Map(orderedKeys.slice(0, MAX_SERIES).map((k, i) => [k, i]));
}

export function diseaseSlots(reference?: Reference): Slots {
  const list = (reference?.diseases ?? []).filter((d) => d.events > 0);
  list.sort((a, b) => b.events - a.events || a.id - b.id);
  return slotMap(list.map((d) => String(d.id)));
}

/** Приоритетные страны: порядок задаёт цвет. */
export const COUNTRY_SLOTS = slotMap(['KAZ', 'RUS', 'CHN', 'KGZ', 'UZB', 'TKM', 'MNG']);

export const STATUS_LABEL: Record<EventStatus, string> = { new: 'Новое', ongoing: 'Продолжается', closed: 'Закрыто' };
export const STATUS_COLOR: Record<EventStatus, string> = { new: 'orange', ongoing: 'red', closed: 'gray' };
export const TRUST_LABEL: Record<TrustLevel, string> = {
  confirmed: 'Подтверждено',
  signal: 'Сигнал',
  analytics: 'Аналитика',
};
export const TRUST_COLOR: Record<TrustLevel, string> = { confirmed: 'blue', signal: 'yellow', analytics: 'grape' };
export const GROUP_LABEL: Record<SpeciesGroup, string> = { CATTLE: 'КРС', SMALL_RUMINANT: 'МРС', OTHER: 'Прочие виды' };

/** Варианты для выпадающего списка из словаря подписей. */
export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
