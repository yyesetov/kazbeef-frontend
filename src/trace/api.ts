// Единственная точка, откуда страница берёт данные пути продукции.
// Сейчас — демо: сканирование меняет данные только в памяти страницы. С бэкендом здесь будут get/send.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demoTrace } from './demo';
import { nextStage } from './model';
import type { Handoff, Lot, TraceOverview } from './types';

export const traceKeys = { overview: ['trace', 'overview'] as const };

/** Как часто обновлять доску, когда данные пойдут с сервера (температура, новые сканирования). */
const POLL_MS = 30_000;

export function useTraceOverview() {
  return useQuery({
    queryKey: traceKeys.overview,
    queryFn: () => Promise.resolve<TraceOverview>(demoTrace()),
    staleTime: Infinity,
    refetchInterval: (q) => (q.state.data?.demo ? false : POLL_MS),
  });
}

export type ScanInput = {
  lotId: string;
  action: 'accepted' | 'rejected';
  tempC: number | null;
  weightKg: number | null;
  reason?: string;
};

/** Отруба одной полутуши: доля веса и цепочка (вырезку продают охлаждённой). */
const CUTS: { product: string; share: number; chain: Lot['chain'] }[] = [
  { product: 'Рибай', share: 0.08, chain: 'frozen' },
  { product: 'Стриплойн', share: 0.07, chain: 'frozen' },
  { product: 'Тендерлойн', share: 0.05, chain: 'chilled' },
  { product: 'Чак-ролл', share: 0.09, chain: 'frozen' },
];

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Что меняется после сканирования. Вынесено из мутации, чтобы логику было видно целиком. */
function applyScan(o: TraceOverview, input: ScanInput, now: string): TraceOverview {
  const lot = o.lots.find((l) => l.id === input.lotId);
  if (!lot) return o;
  const next = nextStage(lot, o.stages);
  if (!next) return o;

  const handoff: Handoff = {
    id: uid('h'),
    lotId: lot.id,
    at: now,
    from: lot.stageId,
    to: input.action === 'accepted' ? next.id : lot.stageId,
    action: input.action,
    by: next.department,
    tempC: input.tempC ?? undefined,
    weightKg: input.weightKg ?? undefined,
    reason: input.reason,
  };

  // Не принят: партия остаётся у прежнего отдела с причиной — её исправляют и передают заново
  if (input.action === 'rejected') {
    return {
      ...o,
      lots: o.lots.map((l) => (l.id === lot.id ? { ...l, status: 'returned', note: input.reason } : l)),
      handoffs: [handoff, ...o.handoffs],
    };
  }

  // Туша после разделки уходит на сортировку отрубами: у каждого ящика свой QR, туша остаётся в истории
  if (lot.kind === 'carcass' && next.id === 'packing') {
    const weight = input.weightKg ?? lot.weightKg;
    const boxes: Lot[] = CUTS.map((c, i) => ({
      ...lot,
      id: uid('l'),
      qr: `${lot.qr.replace('KB-T-', 'KB-B-')}-${i + 1}`,
      kind: 'box',
      product: c.product,
      weightKg: Math.round(weight * c.share * 10) / 10,
      stageId: 'packing',
      enteredAt: now,
      chain: c.chain,
      parentQr: lot.qr,
      status: 'ok',
      note: undefined,
    }));
    const created: Handoff[] = boxes.map((b) => ({
      id: uid('h'),
      lotId: b.id,
      at: now,
      from: null,
      to: 'packing',
      action: 'created',
      by: next.department,
      weightKg: b.weightKg,
    }));
    return {
      ...o,
      lots: [...o.lots.map((l) => (l.id === lot.id ? { ...l, status: 'split' as const } : l)), ...boxes],
      handoffs: [...created, handoff, ...o.handoffs],
    };
  }

  return {
    ...o,
    lots: o.lots.map((l) =>
      l.id === lot.id
        ? {
            ...l,
            stageId: next.id,
            enteredAt: now,
            status: 'ok',
            note: undefined,
            weightKg: input.weightKg ?? l.weightKg,
          }
        : l,
    ),
    handoffs: [handoff, ...o.handoffs],
  };
}

/** Сканирование QR следующим отделом: принять или не принять с причиной. */
export function useScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScanInput) => Promise.resolve(input),
    onSuccess: (input) =>
      qc.setQueryData<TraceOverview>(traceKeys.overview, (o) =>
        o ? applyScan(o, input, new Date().toISOString()) : o,
      ),
  });
}
