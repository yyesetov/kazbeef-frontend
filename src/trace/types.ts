// Путь продукции: от туши до получателя. Каждая передача между отделами — сканирование QR:
// следующий отдел принимает партию или не принимает и возвращает с причиной.
// Бэкенда пока нет: формы ниже — договорённость, под которую он будет сделан. Меняется только src/trace/api.ts.
//
// Предполагаемый контракт:
//   GET  /api/trace/overview         → TraceOverview
//   GET  /api/trace/lots/{qr}        → Lot и его история (Handoff[]), включая родительскую тушу
//   POST /api/trace/lots/{qr}/scan   { action: 'accepted' | 'rejected', tempC, weightKg, reason? }
//   Температуру камер бэкенд читает с датчиков; выход за предел и передержка — оповещение в Telegram.

export type StageId = 'slaughter' | 'aging' | 'cutting' | 'packing' | 'freezing' | 'storage' | 'shipping' | 'delivered';

/** Замороженная продукция проходит шоковую заморозку, охлаждённая — сразу на склад. */
export type Chain = 'frozen' | 'chilled';

/** Требования этапа: допустимая температура и сколько партия может (и должна) на нём пробыть. */
export type StageLimits = {
  tempMin?: number;
  tempMax?: number;
  /** Раньше передавать нельзя: созревание, промерзание до −18 °C в толще */
  minHours?: number;
  /** Дольше держать нельзя: передержка */
  maxHours?: number;
};

export type Stage = StageLimits & {
  id: StageId;
  name: string;
  /** Кто работает на этапе и сканирует приём */
  department: string;
  description: string;
  /** Для охлаждённой продукции требования другие */
  chilled?: StageLimits;
  /** Этап только для одной цепочки */
  only?: Chain;
};

/** Туша — до разделки; после разделки куски упаковываются в ящики со своим QR. */
export type LotKind = 'carcass' | 'box';

/**
 * ok — в работе; returned — следующий отдел не принял, нужно исправить;
 * hold — задержана (ждёт лабораторию, расследование); split — туша разделана на ящики.
 */
export type LotStatus = 'ok' | 'returned' | 'hold' | 'split';

export type Lot = {
  id: string;
  qr: string;
  kind: LotKind;
  /** «Полутуша», «Рибай», «Стриплойн»… */
  product: string;
  /** Категория мраморности */
  grade: string;
  weightKg: number;
  stageId: StageId;
  /** Когда попала на текущий этап (ISO) */
  enteredAt: string;
  chain: Chain;
  /** QR туши, из которой нарезан ящик */
  parentQr?: string;
  /** Бирка животного и хозяйство — для отзыва партии */
  animalTag: string;
  farm: string;
  /** Куда отгружается */
  destination?: string;
  status: LotStatus;
  /** Причина возврата или задержки */
  note?: string;
};

export type HandoffAction = 'created' | 'accepted' | 'rejected';

/** Одно сканирование QR. */
export type Handoff = {
  id: string;
  lotId: string;
  at: string;
  from: StageId | null;
  to: StageId;
  action: HandoffAction;
  /** Кто сканировал */
  by: string;
  tempC?: number;
  weightKg?: number;
  reason?: string;
};

/** Холодильная камера с датчиком температуры. */
export type ColdRoom = {
  id: string;
  name: string;
  stageId: StageId;
  chain?: Chain;
  min: number;
  max: number;
  /** Последние показания, раз в 10 минут, от старых к новым */
  readings: number[];
};

export type TraceOverview = {
  stages: Stage[];
  lots: Lot[];
  handoffs: Handoff[];
  rooms: ColdRoom[];
  /** true — данные демонстрационные */
  demo: boolean;
};
