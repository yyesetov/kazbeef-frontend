// Демонстрационные данные пути продукции. Время отсчитывается от момента загрузки.
import { pathOf } from './model';
import type { Chain, ColdRoom, Handoff, Lot, LotKind, LotStatus, Stage, StageId } from './types';

export const STAGES: Stage[] = [
  {
    id: 'slaughter',
    name: 'Убой и ветосмотр',
    department: 'Убойный цех, ветврач',
    description: 'Туша получает QR, к ней привязываются бирка животного и ветеринарные документы',
    maxHours: 2,
  },
  {
    id: 'aging',
    name: 'Охлаждение и созревание',
    department: 'Камера охлаждения туш',
    description: 'Туша остывает и созревает на кости; раньше срока разделывать нельзя',
    tempMin: 0,
    tempMax: 4,
    minHours: 24,
    maxHours: 72,
  },
  {
    id: 'cutting',
    name: 'Разделка',
    department: 'Цех разделки и обвалки',
    description: 'Туша делится на отруба; без холода мясо может быть не дольше 2 часов',
    tempMax: 12,
    maxHours: 2,
  },
  {
    id: 'packing',
    name: 'Сортировка и упаковка',
    department: 'Сортировщик',
    description: 'Отруба сортируются по мраморности, вакуумируются и кладутся в ящики; на ящик клеится QR',
    tempMax: 7,
    maxHours: 2,
  },
  {
    id: 'freezing',
    name: 'Шоковая заморозка',
    department: 'Оператор камеры заморозки',
    description: 'Промораживание до −18 °C в толще; передерживать в шоковой камере нельзя',
    tempMin: -35,
    tempMax: -25,
    minHours: 12,
    maxHours: 36,
    only: 'frozen',
  },
  {
    id: 'storage',
    name: 'Склад-холодильник',
    department: 'Кладовщик',
    description: 'Хранение до отгрузки: отгружается первым то, что раньше поступило',
    tempMin: -22,
    tempMax: -18,
    maxHours: 365 * 24,
    chilled: { tempMin: 0, tempMax: 4, maxHours: 10 * 24 },
  },
  {
    id: 'shipping',
    name: 'Погрузка и отгрузка',
    department: 'Экспедитор',
    description: 'Погрузка в рефрижератор; на рампе без холода — не дольше часа',
    tempMin: -20,
    tempMax: -18,
    maxHours: 1,
    chilled: { tempMin: 0, tempMax: 4, maxHours: 1 },
  },
  {
    id: 'delivered',
    name: 'Получатель',
    department: 'Магазин или заказчик',
    description: 'Получатель сканирует QR при приёмке — цепочка закрыта',
  },
];

const HOUR = 60 * 60_000;
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

/** Сколько обычно партия проводит на этапе — для восстановления истории передач в демо. */
const TYPICAL_HOURS: Record<StageId, number> = {
  slaughter: 1,
  aging: 50,
  cutting: 1.5,
  packing: 1,
  freezing: 24,
  storage: 60,
  shipping: 0.6,
  delivered: 0,
};

/** Температура продукта, которую «показал» термометр при приёме на этап. */
const TYPICAL_TEMP: Partial<Record<StageId, number>> = {
  aging: 6.5,
  cutting: 2.8,
  packing: 3.4,
  freezing: 3.1,
  storage: -19.2,
  shipping: -19,
  delivered: -18.4,
};

type Seed = {
  qr: string;
  kind: LotKind;
  product: string;
  grade: string;
  weightKg: number;
  stageId: StageId;
  hoursHere: number;
  chain?: Chain;
  parentQr?: string;
  destination?: string;
  status?: LotStatus;
  note?: string;
};

const FARMS = ['КХ «Акбулак», Алматинская обл.', 'ТОО «Береке-Агро», Костанайская обл.'];

const seeds: Seed[] = [
  {
    qr: 'KB-T-0412',
    kind: 'carcass',
    product: 'Полутуша',
    grade: 'Prime',
    weightKg: 168,
    stageId: 'slaughter',
    hoursHere: 0.6,
  },
  {
    qr: 'KB-T-0409',
    kind: 'carcass',
    product: 'Полутуша',
    grade: 'Prime',
    weightKg: 171,
    stageId: 'aging',
    hoursHere: 50,
  },
  {
    qr: 'KB-T-0407',
    kind: 'carcass',
    product: 'Полутуша',
    grade: 'Choice',
    weightKg: 158,
    stageId: 'aging',
    hoursHere: 14,
  },
  {
    qr: 'KB-T-0405',
    kind: 'carcass',
    product: 'Полутуша',
    grade: 'Choice',
    weightKg: 162,
    stageId: 'aging',
    hoursHere: 77,
  },
  {
    qr: 'KB-T-0401',
    kind: 'carcass',
    product: 'Полутуша',
    grade: 'Prime',
    weightKg: 165,
    stageId: 'cutting',
    hoursHere: 1.2,
  },
  {
    qr: 'KB-2611-0142',
    kind: 'box',
    product: 'Рибай',
    grade: 'Prime',
    weightKg: 12.4,
    stageId: 'packing',
    hoursHere: 0.5,
    parentQr: 'KB-T-0398',
  },
  {
    qr: 'KB-2611-0143',
    kind: 'box',
    product: 'Стриплойн',
    grade: 'Prime',
    weightKg: 10.8,
    stageId: 'packing',
    hoursHere: 1.7,
    parentQr: 'KB-T-0398',
  },
  {
    qr: 'KB-2611-0125',
    kind: 'box',
    product: 'Стриплойн',
    grade: 'Choice',
    weightKg: 11,
    stageId: 'packing',
    hoursHere: 0.8,
    parentQr: 'KB-T-0395',
    status: 'returned',
    note: 'Нарушена целостность вакуумной упаковки',
  },
  {
    qr: 'KB-2611-0131',
    kind: 'box',
    product: 'Тендерлойн',
    grade: 'Prime',
    weightKg: 8.2,
    stageId: 'freezing',
    hoursHere: 20,
    parentQr: 'KB-T-0395',
  },
  {
    qr: 'KB-2611-0132',
    kind: 'box',
    product: 'Чак-ролл',
    grade: 'Choice',
    weightKg: 14,
    stageId: 'freezing',
    hoursHere: 38.5,
    parentQr: 'KB-T-0395',
  },
  {
    qr: 'KB-2611-0120',
    kind: 'box',
    product: 'Брискет',
    grade: 'Choice',
    weightKg: 15.5,
    stageId: 'storage',
    hoursHere: 72,
    parentQr: 'KB-T-0391',
  },
  {
    qr: 'KB-2611-0128',
    kind: 'box',
    product: 'Топ-блейд',
    grade: 'Choice',
    weightKg: 9.6,
    stageId: 'storage',
    hoursHere: 26,
    parentQr: 'KB-T-0391',
    status: 'hold',
    note: 'Ожидает результата лаборатории',
  },
  {
    qr: 'KB-2611-0121',
    kind: 'box',
    product: 'Рибай',
    grade: 'Choice',
    weightKg: 12.1,
    stageId: 'storage',
    hoursHere: 49,
    chain: 'chilled',
    parentQr: 'KB-T-0391',
  },
  {
    qr: 'KB-2611-0110',
    kind: 'box',
    product: 'Фарш говяжий',
    grade: '—',
    weightKg: 20,
    stageId: 'shipping',
    hoursHere: 0.4,
    parentQr: 'KB-T-0388',
    destination: 'Магазин №3, Алматы',
  },
  {
    qr: 'KB-2611-0111',
    kind: 'box',
    product: 'Рибай',
    grade: 'Prime',
    weightKg: 12,
    stageId: 'shipping',
    hoursHere: 1.3,
    parentQr: 'KB-T-0388',
    destination: 'Заказчик: ресторан «Стейк-хаус»',
  },
  {
    qr: 'KB-2611-0101',
    kind: 'box',
    product: 'Тендерлойн',
    grade: 'Prime',
    weightKg: 8,
    stageId: 'delivered',
    hoursHere: 5,
    parentQr: 'KB-T-0384',
    destination: 'Магазин №1, Астана',
  },
  {
    qr: 'KB-2611-0102',
    kind: 'box',
    product: 'Брискет',
    grade: 'Choice',
    weightKg: 15,
    stageId: 'delivered',
    hoursHere: 7,
    parentQr: 'KB-T-0384',
    destination: 'Заказчик: ресторан «Стейк-хаус»',
  },
];

function buildLot(s: Seed, i: number): Lot {
  return {
    id: `l${i + 1}`,
    qr: s.qr,
    kind: s.kind,
    product: s.product,
    grade: s.grade,
    weightKg: s.weightKg,
    stageId: s.stageId,
    enteredAt: at(s.hoursHere),
    chain: s.chain ?? 'frozen',
    parentQr: s.parentQr,
    animalTag: `KZ ${String(219000 + ((i * 7919) % 900)).padStart(6, '0')} ${String(4400 + i * 37).slice(-4)}`,
    farm: FARMS[i % FARMS.length] ?? '',
    destination: s.destination,
    status: s.status ?? 'ok',
    note: s.note,
  };
}

/** История передач: от первого этапа пути до текущего, назад от момента прихода на текущий этап. */
function buildHandoffs(lot: Lot, seed: Seed): Handoff[] {
  const path = pathOf(lot, STAGES);
  const idx = path.findIndex((s) => s.id === lot.stageId);
  const out: Handoff[] = [];
  let enteredHoursAgo = seed.hoursHere;
  // Возврат: партия уже уходила на следующий этап и вернулась
  if (lot.status === 'returned') {
    const next = path[idx + 1];
    if (next) {
      out.push({
        id: `${lot.id}-r`,
        lotId: lot.id,
        at: at(seed.hoursHere),
        from: next.id,
        to: lot.stageId,
        action: 'rejected',
        by: next.department,
        tempC: tempFor(next.id, lot.chain),
        weightKg: lot.weightKg,
        reason: lot.note,
      });
      enteredHoursAgo += 0.7;
    }
  }
  for (let i = idx; i >= 0; i--) {
    const stage = path[i];
    if (!stage) continue;
    const prev = i > 0 ? path[i - 1] : undefined;
    out.push({
      id: `${lot.id}-${stage.id}`,
      lotId: lot.id,
      at: at(enteredHoursAgo),
      from: prev?.id ?? null,
      to: stage.id,
      action: i === 0 ? 'created' : 'accepted',
      by: stage.department,
      tempC: tempFor(stage.id, lot.chain),
      weightKg: lot.weightKg,
    });
    if (prev) enteredHoursAgo += TYPICAL_HOURS[prev.id];
  }
  return out;
}

/** Охлаждённая продукция после упаковки держится около +2 °C, а не в минусе. */
function tempFor(stage: StageId, chain: Chain) {
  if (chain === 'chilled' && (stage === 'storage' || stage === 'shipping' || stage === 'delivered')) return 2.6;
  return TYPICAL_TEMP[stage];
}

/** Показания датчика: ровно около значения или с плавным уходом к концу (поломка, открытая дверь). */
function readings(base: number, drift = 0): number[] {
  return Array.from({ length: 18 }, (_, i) => {
    const wobble = Math.sin(i * 1.7) * 0.35;
    const tail = (drift * Math.max(0, i - 11) ** 1.4) / 6 ** 1.4;
    return Math.round((base + wobble + tail) * 10) / 10;
  });
}

const ROOMS: ColdRoom[] = [
  { id: 'k1', name: 'Камера охлаждения туш №1', stageId: 'aging', min: 0, max: 4, readings: readings(2.1) },
  { id: 'k2', name: 'Шоковая заморозка', stageId: 'freezing', min: -35, max: -25, readings: readings(-29) },
  {
    id: 'k3',
    name: 'Холодильник заморозки №2',
    stageId: 'storage',
    chain: 'frozen',
    min: -22,
    max: -18,
    readings: readings(-19.6, 2.9),
  },
  {
    id: 'k4',
    name: 'Камера охлаждённой продукции',
    stageId: 'storage',
    chain: 'chilled',
    min: 0,
    max: 4,
    readings: readings(2.4),
  },
  { id: 'k5', name: 'Рефрижератор, машина 07', stageId: 'shipping', min: -20, max: -18, readings: readings(-18.9) },
];

export function demoTrace() {
  const lots = seeds.map(buildLot);
  const handoffs = lots.flatMap((l, i) => buildHandoffs(l, seeds[i] as Seed));
  return { stages: STAGES, lots, handoffs, rooms: ROOMS, demo: true };
}
