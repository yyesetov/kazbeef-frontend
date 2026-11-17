import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Timeline,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconChevronRight,
  IconClockExclamation,
  IconInfoCircle,
  IconQrcode,
  IconSnowflake,
  IconTemperature,
} from '@tabler/icons-react';
import { Empty, ErrorState, Loading } from '../components/states';
import { StatTile } from '../components/StatTile';
import { fmt, fmtDateTime } from '../lib/format';
import { useScan, useTraceOverview } from '../trace/api';
import {
  REJECT_REASONS,
  acceptWarnings,
  dwell,
  fmtHours,
  limitsOf,
  nextStage,
  roomOf,
  roomState,
  stageIssues,
  type DwellState,
} from '../trace/model';
import type { ColdRoom, Handoff, Lot, Stage, StageId, TraceOverview } from '../trace/types';

const DAY_MS = 24 * 60 * 60_000;

const DWELL_COLOR: Record<DwellState, string> = {
  early: 'blue',
  ok: 'green',
  soon: 'yellow',
  over: 'red',
  none: 'gray',
};

const STATUS_BADGE: Record<Lot['status'], { label: string; color: string } | null> = {
  ok: null,
  returned: { label: 'Возврат', color: 'orange' },
  hold: { label: 'Задержана', color: 'grape' },
  split: { label: 'Разделана', color: 'gray' },
};

const fmtTemp = (t: number) => `${t > 0 ? '+' : ''}${t.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} °C`;

function rangeText(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${fmtTemp(min)} … ${fmtTemp(max)}`;
  if (max !== undefined) return `не выше ${fmtTemp(max)}`;
  if (min !== undefined) return `не ниже ${fmtTemp(min)}`;
  return null;
}

const stageName = (stages: Stage[], id: StageId | null) => stages.find((s) => s.id === id)?.name ?? '—';

// ---------- доска этапов ----------

function FlowBoard({
  data,
  selected,
  onSelect,
}: {
  data: TraceOverview;
  selected: StageId;
  onSelect: (id: StageId) => void;
}) {
  return (
    <div className="kb-flow" role="tablist" aria-label="Этапы процесса">
      {data.stages.map((s, i) => {
        const issues = stageIssues(s.id, data.lots, data.stages, data.rooms);
        const kg = issues.lots.reduce((sum, l) => sum + l.weightKg, 0);
        const problems = issues.over + issues.returned + issues.warmRooms.length;
        const range = rangeText(s.tempMin, s.tempMax);
        return (
          <div key={s.id} className="kb-flow-cell">
            <button
              type="button"
              role="tab"
              aria-selected={selected === s.id}
              className={`kb-stage${problems ? ' problem' : ''}`}
              data-active={selected === s.id || undefined}
              onClick={() => onSelect(s.id)}
            >
              <span className="kb-stage-step">{i + 1}</span>
              <span className="kb-stage-name">{s.name}</span>
              <span className="kb-stage-count">
                {fmt(issues.lots.length)}
                <small> {issues.lots.length ? `· ${fmt(Math.round(kg))} кг` : ''}</small>
              </span>
              <span className="kb-stage-tags">
                {range && (
                  <span className="kb-stage-tag">
                    <IconTemperature size={12} />
                    {range}
                  </span>
                )}
                {issues.over > 0 && (
                  <span className="kb-stage-tag bad">
                    <IconClockExclamation size={12} />
                    Передержка: {issues.over}
                  </span>
                )}
                {issues.returned > 0 && (
                  <span className="kb-stage-tag warn">
                    <IconArrowBackUp size={12} />
                    Возврат: {issues.returned}
                  </span>
                )}
                {issues.warmRooms.length > 0 && (
                  <span className="kb-stage-tag bad">
                    <IconAlertTriangle size={12} />
                    Камера вне нормы
                  </span>
                )}
                {s.only === 'frozen' && <span className="kb-stage-tag">Только замороженная</span>}
              </span>
            </button>
            {i < data.stages.length - 1 && <IconChevronRight className="kb-flow-arrow" size={18} aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

// ---------- партии этапа ----------

function DwellBar({ lot, stage }: { lot: Lot; stage: Stage }) {
  const d = dwell(lot, stage);
  if (d.state === 'none') return <Text size="sm">{fmtHours(d.hours)}</Text>;
  const label =
    d.state === 'early' && d.minHours
      ? `${fmtHours(d.hours)} · можно передавать через ${fmtHours(d.minHours - d.hours)}`
      : d.maxHours
        ? `${fmtHours(d.hours)} из ${fmtHours(d.maxHours)}`
        : fmtHours(d.hours);
  return (
    <div style={{ minWidth: 150 }}>
      <Text size="xs" c={d.state === 'over' ? 'red' : undefined} fw={d.state === 'over' ? 600 : undefined}>
        {d.state === 'over' ? `Передержка: ${label}` : label}
      </Text>
      <Progress size={5} value={Math.min(100, d.ratio * 100)} color={DWELL_COLOR[d.state]} mt={3} />
    </div>
  );
}

function StatusBadge({ lot }: { lot: Lot }) {
  const b = STATUS_BADGE[lot.status];
  if (!b) return null;
  return (
    <Tooltip label={lot.note} disabled={!lot.note} multiline maw={260}>
      <Badge size="sm" variant="light" color={b.color}>
        {b.label}
      </Badge>
    </Tooltip>
  );
}

function StageLots({ data, stageId, onOpen }: { data: TraceOverview; stageId: StageId; onOpen: (l: Lot) => void }) {
  const stage = data.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  const lots = data.lots
    .filter((l) => l.stageId === stageId && l.status !== 'split')
    .sort((a, b) => dwell(b, stage).ratio - dwell(a, stage).ratio);
  const limits = rangeText(stage.tempMin, stage.tempMax);
  return (
    <div className="kb-card">
      <div className="kb-card-title">{stage.name}</div>
      <div className="kb-card-sub">
        {stage.department} · {stage.description}
        {limits ? ` · Температура: ${limits}` : ''}
      </div>
      {lots.length === 0 ? (
        <Empty text="На этом этапе сейчас ничего нет" />
      ) : (
        <Table.ScrollContainer minWidth={640} mt="sm">
          <Table verticalSpacing={7} fz="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>QR</Table.Th>
                <Table.Th>Продукт</Table.Th>
                <Table.Th className="kb-num">Вес</Table.Th>
                <Table.Th>На этапе</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lots.map((l) => (
                <Table.Tr
                  key={l.id}
                  className="kb-row"
                  tabIndex={0}
                  aria-label={`Открыть партию ${l.qr}`}
                  onClick={() => onOpen(l)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(l);
                    }
                  }}
                >
                  <Table.Td className="kb-mono">{l.qr}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {l.product}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {l.grade !== '—' ? `${l.grade} · ` : ''}
                      {l.kind === 'carcass' ? 'туша' : l.chain === 'chilled' ? 'охлаждённая' : 'замороженная'}
                      {l.destination ? ` · ${l.destination}` : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td className="kb-num">{fmt(l.weightKg)} кг</Table.Td>
                  <Table.Td>
                    <DwellBar lot={l} stage={stage} />
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge lot={l} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </div>
  );
}

// ---------- холодильные камеры ----------

function Sparkline({ room }: { room: ColdRoom }) {
  const w = 120;
  const h = 32;
  const values = room.readings;
  const lo = Math.min(room.min, ...values) - 0.5;
  const hi = Math.max(room.max, ...values) + 0.5;
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="kb-spark" aria-hidden>
      {/* полоса нормы */}
      <rect x={0} y={y(room.max)} width={w} height={y(room.min) - y(room.max)} className="kb-spark-band" />
      <polyline points={points} fill="none" className="kb-spark-line" />
    </svg>
  );
}

function ColdRooms({ rooms }: { rooms: ColdRoom[] }) {
  return (
    <div className="kb-card">
      <div className="kb-card-title">Холодильные камеры</div>
      <div className="kb-card-sub">Датчики, последние 3 часа. Выход за норму — сразу оповещение в Telegram.</div>
      <Stack gap={0} mt="xs">
        {rooms.map((r) => {
          const s = roomState(r);
          return (
            <div key={r.id} className={`kb-room-temp${s.ok ? '' : ' bad'}`}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={600} truncate>
                  {r.name}
                </Text>
                <Text size="xs" c="dimmed">
                  Норма {rangeText(r.min, r.max)}
                </Text>
              </div>
              <Sparkline room={r} />
              <div className="kb-room-temp-value">
                {fmtTemp(s.current)}
                {!s.ok && (
                  <Text size="xs" c="red" fw={600}>
                    Вне нормы
                  </Text>
                )}
              </div>
            </div>
          );
        })}
      </Stack>
    </div>
  );
}

// ---------- карточка партии и сканирование ----------

function HandoffItem({ h, stages, lotQr }: { h: Handoff; stages: Stage[]; lotQr?: string }) {
  const title =
    h.action === 'created'
      ? `Создана: ${stageName(stages, h.to)}`
      : h.action === 'rejected'
        ? `Не принята: ${h.by}, возвращена на «${stageName(stages, h.to)}»`
        : `Принята: ${stageName(stages, h.to)}`;
  return (
    <Timeline.Item
      bullet={
        h.action === 'rejected' ? (
          <IconArrowBackUp size={12} />
        ) : h.action === 'created' ? (
          <IconQrcode size={12} />
        ) : (
          <IconCheck size={12} />
        )
      }
      color={h.action === 'rejected' ? 'orange' : 'brand'}
      title={
        <Text size="sm" fw={600}>
          {title}
        </Text>
      }
    >
      <Text size="xs" c="dimmed">
        {fmtDateTime(h.at)} · {h.by}
        {lotQr ? ` · ${lotQr}` : ''}
      </Text>
      <Text size="xs" c="dimmed">
        {[h.tempC !== undefined ? fmtTemp(h.tempC) : null, h.weightKg !== undefined ? `${fmt(h.weightKg)} кг` : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {h.reason && (
        <Text size="xs" c="orange" fw={500}>
          Причина: {h.reason}
        </Text>
      )}
    </Timeline.Item>
  );
}

function ScanForm({ lot, data, onDone }: { lot: Lot; data: TraceOverview; onDone: () => void }) {
  const scan = useScan();
  const stage = data.stages.find((s) => s.id === lot.stageId) as Stage;
  const target = nextStage(lot, data.stages);
  const [action, setAction] = useState<'accepted' | 'rejected'>('accepted');
  const [tempC, setTempC] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(lot.weightKg);
  const [reason, setReason] = useState<string | null>(null);

  if (!target) return null;
  const warnings = action === 'accepted' ? acceptWarnings(lot, stage, target, { tempC, weightKg }) : [];
  const limits = limitsOf(stage, lot.chain);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    scan.mutate(
      { lotId: lot.id, action, tempC, weightKg, reason: action === 'rejected' ? (reason ?? undefined) : undefined },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="kb-scan">
      <Text size="sm" fw={600}>
        Сканирование: {target.department}
      </Text>
      <Text size="xs" c="dimmed" mb={6}>
        Отдел «{target.name}» принимает партию от «{stage.name}» или возвращает её с причиной
      </Text>
      <SegmentedControl
        fullWidth
        value={action}
        onChange={(v) => setAction(v as 'accepted' | 'rejected')}
        data={[
          { value: 'accepted', label: 'Принять' },
          { value: 'rejected', label: 'Не принять' },
        ]}
        aria-label="Решение по партии"
      />
      <Group grow mt="sm" align="flex-start">
        <NumberInput
          label="Температура продукта, °C"
          description={rangeText(limits.tempMin, limits.tempMax) ?? 'Без нормы'}
          value={tempC ?? ''}
          onChange={(v) => setTempC(typeof v === 'number' ? v : null)}
          decimalScale={1}
          step={0.5}
        />
        <NumberInput
          label="Вес, кг"
          description={`Заявлено ${fmt(lot.weightKg)} кг`}
          value={weightKg ?? ''}
          onChange={(v) => setWeightKg(typeof v === 'number' ? v : null)}
          decimalScale={1}
          min={0}
        />
      </Group>
      {action === 'rejected' && (
        <Select
          mt="sm"
          label="Причина"
          required
          data={[...REJECT_REASONS]}
          value={reason}
          onChange={setReason}
          searchable
        />
      )}
      {warnings.length > 0 && (
        <Alert mt="sm" color="orange" variant="light" p="xs" icon={<IconAlertTriangle size={16} />}>
          <Stack gap={2}>
            {warnings.map((w) => (
              <Text key={w} size="xs">
                {w}
              </Text>
            ))}
            <Text size="xs" fw={600}>
              Принять всё равно можно, замечание сохранится в истории.
            </Text>
          </Stack>
        </Alert>
      )}
      <Button
        type="submit"
        mt="sm"
        fullWidth
        color={action === 'rejected' ? 'orange' : undefined}
        disabled={action === 'rejected' && !reason}
        loading={scan.isPending}
        leftSection={action === 'rejected' ? <IconArrowBackUp size={16} /> : <IconCheck size={16} />}
      >
        {action === 'rejected'
          ? `Вернуть на «${stage.name}»`
          : lot.kind === 'carcass' && target.id === 'packing'
            ? 'Принять отруба: каждый ящик получит свой QR'
            : `Принять на «${target.name}»`}
      </Button>
    </form>
  );
}

function LotDrawer({ lotId, data, onClose }: { lotId: string | null; data: TraceOverview; onClose: () => void }) {
  const lot = data.lots.find((l) => l.id === lotId) ?? null;
  const stage = lot ? data.stages.find((s) => s.id === lot.stageId) : undefined;
  const parent = lot?.parentQr ? data.lots.find((l) => l.qr === lot.parentQr) : undefined;
  const room = lot ? roomOf(lot, data.rooms) : undefined;
  const history = lot
    ? [
        ...data.handoffs.filter((h) => h.lotId === lot.id).map((h) => ({ h, qr: undefined as string | undefined })),
        ...(parent ? data.handoffs.filter((h) => h.lotId === parent.id).map((h) => ({ h, qr: parent.qr })) : []),
      ].sort((a, b) => b.h.at.localeCompare(a.h.at))
    : [];

  return (
    <Drawer opened={lot !== null} onClose={onClose} position="right" size="md" title={lot ? `Партия ${lot.qr}` : ''}>
      {lot && stage && (
        <Stack gap="md">
          <div>
            <Group gap={6}>
              <Text fw={700} size="lg">
                {lot.product}
              </Text>
              <StatusBadge lot={lot} />
            </Group>
            <Text size="sm" c="dimmed">
              {[
                lot.grade !== '—' ? `Мраморность ${lot.grade}` : null,
                `${fmt(lot.weightKg)} кг`,
                lot.kind === 'carcass' ? 'туша' : lot.chain === 'chilled' ? 'охлаждённая' : 'замороженная',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </div>

          <div className="kb-lot-facts">
            <span>Этап</span>
            <b>{stage.name}</b>
            {lot.status !== 'split' && stage.maxHours && (
              <>
                <span>На этапе</span>
                <DwellBar lot={lot} stage={stage} />
              </>
            )}
            {room && (
              <>
                <span>Камера</span>
                <b>
                  {room.name}, {fmtTemp(roomState(room).current)}
                </b>
              </>
            )}
            <span>Животное</span>
            <b className="kb-mono">{lot.animalTag}</b>
            <span>Хозяйство</span>
            <b>{lot.farm}</b>
            {lot.parentQr && (
              <>
                <span>Из туши</span>
                <b className="kb-mono">{lot.parentQr}</b>
              </>
            )}
            {lot.destination && (
              <>
                <span>Получатель</span>
                <b>{lot.destination}</b>
              </>
            )}
          </div>

          {lot.status === 'returned' && lot.note && (
            <Alert color="orange" variant="light" p="xs" icon={<IconArrowBackUp size={16} />}>
              Следующий отдел не принял: {lot.note}. Исправьте и передайте заново.
            </Alert>
          )}
          {lot.status === 'hold' && (
            <Alert color="grape" variant="light" p="xs" icon={<IconInfoCircle size={16} />}>
              Партия задержана: {lot.note}. Передавать дальше нельзя, пока задержку не снимут.
            </Alert>
          )}

          {lot.status !== 'split' && lot.status !== 'hold' && nextStage(lot, data.stages) && (
            <ScanForm key={`${lot.id}-${lot.stageId}-${lot.status}`} lot={lot} data={data} onDone={() => undefined} />
          )}
          {lot.stageId === 'delivered' && (
            <Text size="sm" c="dimmed">
              Получатель принял партию — цепочка закрыта.
            </Text>
          )}

          <div>
            <Text size="sm" fw={600} mb="xs">
              История: кто, когда и в каком состоянии передал
            </Text>
            <Timeline bulletSize={20} lineWidth={2}>
              {history.map(({ h, qr }) => (
                <HandoffItem key={h.id} h={h} stages={data.stages} lotQr={qr} />
              ))}
            </Timeline>
          </div>
        </Stack>
      )}
    </Drawer>
  );
}

// ---------- журнал передач ----------

function HandoffLog({ data, onOpen }: { data: TraceOverview; onOpen: (lotId: string) => void }) {
  const lots = useMemo(() => new Map(data.lots.map((l) => [l.id, l])), [data.lots]);
  const recent = [...data.handoffs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return (
    <div className="kb-card">
      <div className="kb-card-title">Последние сканирования</div>
      <div className="kb-card-sub">Каждая передача между отделами — сканирование QR. Возвраты выделены.</div>
      <Table.ScrollContainer minWidth={640} mt="sm">
        <Table verticalSpacing={6} fz="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Когда</Table.Th>
              <Table.Th>QR</Table.Th>
              <Table.Th>Передача</Table.Th>
              <Table.Th>Кто</Table.Th>
              <Table.Th className="kb-num">Темп.</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recent.map((h) => {
              const lot = lots.get(h.lotId);
              return (
                <Table.Tr key={h.id} className="kb-row" onClick={() => onOpen(h.lotId)}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</Table.Td>
                  <Table.Td className="kb-mono">{lot?.qr}</Table.Td>
                  <Table.Td>
                    {h.action === 'rejected' ? (
                      <Text size="sm" c="orange" fw={500}>
                        ↩ Не принята: {h.reason}
                      </Text>
                    ) : h.action === 'created' ? (
                      <Text size="sm">Создана на этапе «{stageName(data.stages, h.to)}»</Text>
                    ) : (
                      <Text size="sm">
                        {stageName(data.stages, h.from)} → {stageName(data.stages, h.to)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{h.by}</Text>
                  </Table.Td>
                  <Table.Td className="kb-num">{h.tempC !== undefined ? fmtTemp(h.tempC) : '—'}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}

// ---------- страница ----------

function QrSearch({ data, onFound }: { data: TraceOverview; onFound: (lotId: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = code.trim().toUpperCase();
    if (!q) return;
    const lot =
      data.lots.find((l) => l.qr.toUpperCase() === q) ?? data.lots.find((l) => l.qr.toUpperCase().endsWith(q));
    if (lot) {
      setError(null);
      onFound(lot.id);
    } else setError('Партия с таким QR не найдена');
  };
  return (
    <form onSubmit={submit} className="kb-card kb-qr-search">
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="kb-card-title">Найти партию по QR</div>
        <div className="kb-card-sub">
          Введите код или отсканируйте сканером штрихкодов — он печатает код в поле. Скоро — сканирование камерой
          телефона.
        </div>
      </div>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          placeholder="KB-2611-0142"
          aria-label="QR-код партии"
          leftSection={<IconQrcode size={16} />}
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value);
            setError(null);
          }}
          error={error}
          w={220}
          classNames={{ input: 'kb-mono' }}
        />
        <Button type="submit">Найти</Button>
      </Group>
    </form>
  );
}

export function TraceabilityPage() {
  const overview = useTraceOverview();
  const [stageId, setStageId] = useState<StageId>('aging');
  const [lotId, setLotId] = useState<string | null>(null);

  if (overview.isPending) return <Loading height={240} />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;

  const data = overview.data;
  const now = Date.now();
  const active = data.lots.filter((l) => l.status !== 'split' && l.stageId !== 'delivered');
  const kg = active.reduce((s, l) => s + l.weightKg, 0);
  const over = active.filter((l) => {
    const st = data.stages.find((s) => s.id === l.stageId);
    return st ? dwell(l, st, now).state === 'over' : false;
  }).length;
  const warmRooms = data.rooms.filter((r) => !roomState(r).ok).length;
  const returned = active.filter((l) => l.status === 'returned' || l.status === 'hold').length;
  const delivered = data.handoffs.filter(
    (h) => h.to === 'delivered' && h.action === 'accepted' && now - new Date(h.at).getTime() <= DAY_MS,
  ).length;

  return (
    <Stack gap="md">
      {data.demo && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} p="sm">
          Демонстрационный режим: данные условные, сканирование работает только на этой странице до перезагрузки.
          Откройте любую партию и попробуйте принять или вернуть её — так будет работать каждый отдел.
        </Alert>
      )}

      {/* Полоса на четыре показателя, как на странице видеомониторинга */}
      <div className="kb-stats kb-stats-4">
        <StatTile label="В работе" value={fmt(active.length)} hint={`${fmt(Math.round(kg))} кг продукции`} />
        <StatTile
          label="Требуют внимания"
          value={fmt(over + warmRooms)}
          hint={`Передержка: ${over} · камер вне нормы: ${warmRooms}`}
          marker={over + warmRooms ? '#d03b3b' : undefined}
        />
        <StatTile label="Возвраты и задержки" value={fmt(returned)} hint="Не приняты следующим отделом или задержаны" />
        <StatTile label="Доставлено за сутки" value={fmt(delivered)} hint="Получатель отсканировал QR" />
      </div>

      <QrSearch data={data} onFound={setLotId} />

      <FlowBoard data={data} selected={stageId} onSelect={setStageId} />

      <div className="kb-video-bottom">
        <StageLots data={data} stageId={stageId} onOpen={(l) => setLotId(l.id)} />
        <ColdRooms rooms={data.rooms} />
      </div>

      <HandoffLog data={data} onOpen={setLotId} />

      <Group gap={6} c="dimmed">
        <IconSnowflake size={14} />
        <Text size="xs" c="dimmed">
          Охлаждённая продукция минует шоковую заморозку и хранится при 0…+4 °C до 10 суток; замороженная — при −18 °C и
          ниже.
        </Text>
      </Group>

      <LotDrawer lotId={lotId} data={data} onClose={() => setLotId(null)} />
    </Stack>
  );
}
