// Подписи пути продукции: температура, диапазон нормы, срок на этапе.
import { fmtHours } from './model';
import type { StageLimits } from './types';

/** Температура со знаком: +2,1 °C, −18 °C. Минус — типографский, как на табло. */
export const fmtTemp = (t: number, unit = true) =>
  `${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}${unit ? ' °C' : ''}`;

export function rangeText(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${fmtTemp(min, false)} … ${fmtTemp(max)}`;
  if (max !== undefined) return `не выше ${fmtTemp(max)}`;
  if (min !== undefined) return `не ниже ${fmtTemp(min)}`;
  return null;
}

/** Сколько можно держать на этапе: «24 ч – 3 сут», «до 2 ч». Сроки длиннее месяца не показываем: это хранение. */
export function windowText({ minHours, maxHours }: StageLimits) {
  if (maxHours && maxHours > 30 * 24) return null;
  if (minHours && maxHours) return `${fmtHours(minHours)} – ${fmtHours(maxHours)}`;
  if (maxHours) return `до ${fmtHours(maxHours)}`;
  if (minHours) return `от ${fmtHours(minHours)}`;
  return null;
}

/** «1 партия», «3 партии», «7 партий». */
export function lotsWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'партия';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'партии';
  return 'партий';
}
