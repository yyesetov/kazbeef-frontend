import { describe, expect, it } from 'vitest';
import { STAGES } from './demo';
import { acceptWarnings, dwell, fmtHours, nextStage, pathOf, roomState } from './model';
import type { Lot, Stage } from './types';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const stage = (id: string) => STAGES.find((s) => s.id === id) as Stage;

const lot = (p: Partial<Lot>): Lot => ({
  id: 'l1',
  qr: 'KB-1',
  kind: 'box',
  product: 'Рибай',
  grade: 'Prime',
  weightKg: 10,
  stageId: 'packing',
  enteredAt: hoursAgo(1),
  chain: 'frozen',
  animalTag: 'KZ',
  farm: 'КХ',
  status: 'ok',
  ...p,
});

describe('путь партии', () => {
  it('туша идёт до упаковки, ящик — с упаковки до получателя', () => {
    expect(pathOf({ kind: 'carcass', chain: 'frozen' }, STAGES).map((s) => s.id)).toEqual([
      'slaughter',
      'aging',
      'cutting',
      'packing',
    ]);
    expect(pathOf({ kind: 'box', chain: 'frozen' }, STAGES).map((s) => s.id)).toEqual([
      'packing',
      'freezing',
      'storage',
      'shipping',
      'delivered',
    ]);
  });

  it('охлаждённая продукция минует шоковую заморозку', () => {
    expect(nextStage(lot({ chain: 'chilled' }), STAGES)?.id).toBe('storage');
    expect(nextStage(lot({ chain: 'frozen' }), STAGES)?.id).toBe('freezing');
  });

  it('после получателя этапов нет', () => {
    expect(nextStage(lot({ stageId: 'delivered' }), STAGES)).toBeUndefined();
  });
});

describe('dwell', () => {
  it('рано передавать, пока не вышло минимальное время', () => {
    expect(dwell(lot({ stageId: 'aging', enteredAt: hoursAgo(10) }), stage('aging'), NOW).state).toBe('early');
  });

  it('передержка после максимального времени', () => {
    expect(dwell(lot({ stageId: 'freezing', enteredAt: hoursAgo(40) }), stage('freezing'), NOW).state).toBe('over');
  });

  it('предупреждает, когда прошло больше 75% срока', () => {
    expect(dwell(lot({ stageId: 'aging', enteredAt: hoursAgo(60) }), stage('aging'), NOW).state).toBe('soon');
  });

  it('для охлаждённой продукции свой срок хранения', () => {
    const chilled = lot({ stageId: 'storage', chain: 'chilled', enteredAt: hoursAgo(11 * 24) });
    expect(dwell(chilled, stage('storage'), NOW).state).toBe('over');
    expect(dwell({ ...chilled, chain: 'frozen' }, stage('storage'), NOW).state).toBe('ok');
  });
});

describe('acceptWarnings', () => {
  it('без замечаний, если всё в норме', () => {
    const l = lot({ stageId: 'packing', enteredAt: hoursAgo(1) });
    expect(acceptWarnings(l, stage('packing'), stage('freezing'), { tempC: 3, weightKg: 10.1 }, NOW)).toEqual([]);
  });

  it('теплый продукт и расхождение веса', () => {
    const l = lot({ stageId: 'packing', enteredAt: hoursAgo(1) });
    const w = acceptWarnings(l, stage('packing'), stage('freezing'), { tempC: 9, weightKg: 9.5 }, NOW);
    expect(w).toHaveLength(2);
    expect(w[0]).toContain('теплее нормы');
    expect(w[1]).toContain('отличается');
  });
});

describe('вспомогательное', () => {
  it('длительность по-русски', () => {
    expect(fmtHours(0.5)).toBe('30 мин');
    expect(fmtHours(5.5)).toBe('5 ч 30 мин');
    expect(fmtHours(76)).toBe('3 сут 4 ч');
  });

  it('камера вне диапазона', () => {
    expect(roomState({ id: 'k', name: 'К', stageId: 'storage', min: -22, max: -18, readings: [-19, -16.5] })).toEqual({
      current: -16.5,
      ok: false,
    });
  });
});
