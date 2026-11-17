// Правила процесса: порядок этапов, передержка, проверки при приёме. Чистые функции — их проверяют тесты.
import type { Chain, ColdRoom, Lot, Stage, StageId, StageLimits } from './types';

/** Причины, по которым следующий отдел может не принять партию. */
export const REJECT_REASONS = [
  'Нарушена целостность вакуумной упаковки',
  'Температура продукта вне нормы',
  'Расхождение веса',
  'Неверная или нечитаемая маркировка',
  'Дефект разделки (зачистка, посторонние включения)',
  'Изменение цвета или запаха',
  'Нет ветеринарных документов',
] as const;

/** Допустимое расхождение веса при приёме: больше — повод проверить. */
export const WEIGHT_TOLERANCE = 0.02;

const HOUR = 60 * 60_000;

/** Этапы, через которые идёт партия: туша — до разделки, ящик — с упаковки; охлаждённая минует заморозку. */
export function pathOf(lot: Pick<Lot, 'kind' | 'chain'>, stages: Stage[]): Stage[] {
  const forChain = stages.filter((s) => !s.only || s.only === lot.chain);
  const packing = forChain.findIndex((s) => s.id === 'packing');
  return lot.kind === 'carcass' ? forChain.slice(0, packing + 1) : forChain.slice(packing);
}

export function nextStage(lot: Lot, stages: Stage[]): Stage | undefined {
  const path = pathOf(lot, stages);
  return path[path.findIndex((s) => s.id === lot.stageId) + 1];
}

export function limitsOf(stage: Stage, chain: Chain): StageLimits {
  return chain === 'chilled' && stage.chilled ? { ...stage, ...stage.chilled } : stage;
}

export type DwellState = 'early' | 'ok' | 'soon' | 'over' | 'none';

/**
 * Сколько партия на этапе и в каком это состоянии:
 * early — ещё рано передавать, soon — истекает (больше 75% срока), over — передержка.
 */
export function dwell(lot: Lot, stage: Stage, now = Date.now()) {
  const hours = (now - new Date(lot.enteredAt).getTime()) / HOUR;
  const { minHours, maxHours } = limitsOf(stage, lot.chain);
  const ratio = maxHours ? hours / maxHours : 0;
  let state: DwellState = 'none';
  if (maxHours) state = hours > maxHours ? 'over' : ratio >= 0.75 ? 'soon' : 'ok';
  if (minHours && hours < minHours) state = 'early';
  return { hours, ratio, state, minHours, maxHours };
}

/** Длительность по-русски: 40 мин, 5 ч 10 мин, 3 сут 4 ч. */
export function fmtHours(hours: number): string {
  const m = Math.round(hours * 60);
  if (m < 60) return `${m} мин`;
  if (m < 24 * 60) return m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`;
  const h = Math.floor(m / 60);
  return h % 24 ? `${Math.floor(h / 24)} сут ${h % 24} ч` : `${h / 24} сут`;
}

export function roomState(room: ColdRoom) {
  const current = room.readings[room.readings.length - 1] ?? NaN;
  return { current, ok: current >= room.min && current <= room.max };
}

/** Датчик камеры присылает показание раз в 10 минут. */
export const READING_MINUTES = 10;
/** Тренд считается по последнему часу: 7 показаний. */
const TREND_POINTS = 7;
/** Прогноз выхода за норму показываем, только если он ближе этого горизонта. */
const ETA_HORIZON_MIN = 180;
/** «Близко к границе»: до края нормы меньше этой доли её ширины. */
const EDGE_SHARE = 0.15;

export type RoomLevel = 'ok' | 'warn' | 'bad';

/**
 * Что происходит в камере: скорость изменения за последний час (°C/ч), сколько минут она уже вне нормы,
 * через сколько минут выйдет за норму при нынешнем темпе и общий уровень.
 */
export function roomTrend(room: ColdRoom) {
  const { current, ok } = roomState(room);
  const tail = room.readings.slice(-TREND_POINTS);
  const n = tail.length;
  // Наклон прямой по методу наименьших квадратов, в °C за одно показание
  let slope = 0;
  if (n >= 2) {
    const mx = (n - 1) / 2;
    const my = tail.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    tail.forEach((v, i) => {
      num += (i - mx) * (v - my);
      den += (i - mx) ** 2;
    });
    slope = den ? num / den : 0;
  }
  const perHour = slope * (60 / READING_MINUTES);

  let outReadings = 0;
  for (let i = room.readings.length - 1; i >= 0; i--) {
    const v = room.readings[i] as number;
    if (v >= room.min && v <= room.max) break;
    outReadings++;
  }
  // Первое показание вне нормы — момент выхода: длительность считается от него
  const outMinutes = outReadings ? (outReadings - 1) * READING_MINUTES : 0;

  let etaMinutes: number | null = null;
  if (ok && Math.abs(perHour) >= 0.05) {
    const bound = perHour > 0 ? room.max : room.min;
    const eta = ((bound - current) / perHour) * 60;
    if (eta >= 0 && eta <= ETA_HORIZON_MIN) etaMinutes = Math.round(eta);
  }

  const span = room.max - room.min;
  const margin = Math.min(current - room.min, room.max - current);
  const level: RoomLevel = !ok ? 'bad' : etaMinutes !== null || margin < span * EDGE_SHARE ? 'warn' : 'ok';
  return { current, ok, perHour, outMinutes, etaMinutes, level, bound: perHour > 0 ? room.max : room.min };
}

/** Камера, где лежит партия (по этапу и цепочке). */
export function roomOf(lot: Lot, rooms: ColdRoom[]): ColdRoom | undefined {
  return rooms.find((r) => r.stageId === lot.stageId && (!r.chain || r.chain === lot.chain));
}

/** Что проверить перед приёмом: ранняя передача, передержка, температура продукта, вес. */
export function acceptWarnings(
  lot: Lot,
  stage: Stage,
  target: Stage | undefined,
  input: { tempC: number | null; weightKg: number | null },
  now = Date.now(),
): string[] {
  const out: string[] = [];
  const d = dwell(lot, stage, now);
  if (d.state === 'early' && d.minHours) {
    out.push(
      `На этапе «${stage.name}» партия должна пробыть не меньше ${fmtHours(d.minHours)}, прошло ${fmtHours(d.hours)}`,
    );
  }
  if (d.state === 'over' && d.maxHours) {
    out.push(`Передержка на этапе «${stage.name}»: ${fmtHours(d.hours)} при норме до ${fmtHours(d.maxHours)}`);
  }
  // Температура продукта при передаче проверяется по норме того этапа, откуда он пришёл
  const { tempMin, tempMax } = limitsOf(stage, lot.chain);
  if (input.tempC !== null) {
    if (tempMax !== undefined && input.tempC > tempMax)
      out.push(`Продукт теплее нормы: ${input.tempC} °C при норме до ${tempMax} °C`);
    if (tempMin !== undefined && input.tempC < tempMin)
      out.push(`Продукт холоднее нормы: ${input.tempC} °C при норме от ${tempMin} °C`);
  }
  if (input.weightKg !== null && Math.abs(input.weightKg - lot.weightKg) > lot.weightKg * WEIGHT_TOLERANCE) {
    out.push(
      `Вес ${input.weightKg} кг отличается от заявленного ${lot.weightKg} кг больше чем на ${WEIGHT_TOLERANCE * 100}%`,
    );
  }
  if (!target) out.push('Это последний этап: дальше передавать некуда');
  return out;
}

/** Этапы, на которых сейчас есть партии с проблемами. */
export function stageIssues(stageId: StageId, lots: Lot[], stages: Stage[], rooms: ColdRoom[], now = Date.now()) {
  const stage = stages.find((s) => s.id === stageId);
  const here = lots.filter((l) => l.stageId === stageId && l.status !== 'split');
  return {
    lots: here,
    over: stage ? here.filter((l) => dwell(l, stage, now).state === 'over').length : 0,
    returned: here.filter((l) => l.status === 'returned').length,
    hold: here.filter((l) => l.status === 'hold').length,
    warmRooms: rooms.filter((r) => r.stageId === stageId && !roomState(r).ok),
  };
}
