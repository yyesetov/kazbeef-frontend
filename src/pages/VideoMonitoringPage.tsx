import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBrandTelegram,
  IconCheck,
  IconInfoCircle,
  IconSparkles,
  IconVideoOff,
  IconX,
} from '@tabler/icons-react';
import { Empty, ErrorState, Loading } from '../components/states';
import { StatTile } from '../components/StatTile';
import { fmt, fmtDateTime } from '../lib/format';
import { useReviewEvent, useVideoOverview } from '../video/api';
import type { Camera, Review, Room, Rule, Severity, VideoEvent, VideoOverview } from '../video/types';

const SEVERITY_LABEL: Record<Severity, string> = { gross: 'Грубое', violation: 'Нарушение', notice: 'Замечание' };
const SEVERITY_COLOR: Record<Severity, string> = { gross: 'red', violation: 'orange', notice: 'yellow' };
const SEVERITY_ORDER: Record<Severity, number> = { gross: 0, violation: 1, notice: 2 };

/** Событие считается «текущим» и подсвечивает камеру столько минут. */
const ACTIVE_MINUTES = 30;
const DAY_MS = 24 * 60 * 60_000;

type SeverityFilter = Severity | 'all';

const minutesAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;

function relTime(iso: string) {
  const m = Math.round(minutesAgo(iso));
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} ч назад`;
  return fmtDateTime(iso);
}

/** Активное событие: недавнее и не отмечено как ложное. */
const isActive = (e: VideoEvent) => e.review !== 'false' && minutesAgo(e.at) <= ACTIVE_MINUTES;

/** Самое серьёзное из активных событий — его и показываем на камере и в списке помещений. */
function worstActive(events: VideoEvent[]) {
  return events.filter(isActive).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
}

const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <Badge size="sm" variant={severity === 'gross' ? 'filled' : 'light'} color={SEVERITY_COLOR[severity]}>
    {SEVERITY_LABEL[severity]}
  </Badge>
);

// ---------- камеры ----------

function CameraScreen({ camera, alert, rule }: { camera: Camera; alert?: VideoEvent; rule?: Rule }) {
  const online = camera.status === 'online';
  return (
    <div className="kb-cam-screen">
      {camera.streamUrl && online ? (
        <video src={camera.streamUrl} muted autoPlay playsInline />
      ) : (
        <div className="kb-cam-placeholder">
          <IconVideoOff size={28} stroke={1.4} />
          <span>{online ? 'Поток будет подключён' : 'Нет сигнала'}</span>
        </div>
      )}
      <span className={`kb-cam-live${online ? '' : ' off'}`}>{online ? 'В сети' : 'Не в сети'}</span>
      {camera.aiEnabled && (
        <span className="kb-cam-ai">
          <IconSparkles size={12} /> ИИ
        </span>
      )}
      {alert && (
        <div className={`kb-cam-alert ${alert.severity}`}>
          <IconAlertTriangle size={14} />
          <span>
            {SEVERITY_LABEL[alert.severity]}: {rule?.name ?? alert.ruleId}
          </span>
        </div>
      )}
    </div>
  );
}

function CameraTile({
  camera,
  events,
  rules,
  onOpen,
}: {
  camera: Camera;
  events: VideoEvent[];
  rules: Map<string, Rule>;
  onOpen: () => void;
}) {
  const alert = worstActive(events);
  const last = events[0];
  return (
    <button
      type="button"
      className={`kb-cam${alert ? ` alert ${alert.severity}` : ''}`}
      onClick={onOpen}
      aria-label={`Камера «${camera.name}»${alert ? `: ${SEVERITY_LABEL[alert.severity].toLowerCase()} нарушение` : ''}`}
    >
      <CameraScreen camera={camera} alert={alert} rule={alert ? rules.get(alert.ruleId) : undefined} />
      <div className="kb-cam-caption">
        <span className="kb-cam-name">{camera.name}</span>
        <span className="kb-cam-meta">{last ? `Последнее событие ${relTime(last.at)}` : 'Нарушений не было'}</span>
      </div>
    </button>
  );
}

// ---------- помещения ----------

function RoomPicker({
  rooms,
  cameras,
  events,
  value,
  onChange,
}: {
  rooms: Room[];
  cameras: Camera[];
  events: VideoEvent[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="kb-rooms" role="tablist" aria-label="Помещения">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        className="kb-room"
        data-active={value === null || undefined}
        onClick={() => onChange(null)}
      >
        <span className="kb-room-name">Все помещения</span>
        <span className="kb-room-meta">{cameras.length} камер</span>
      </button>
      {rooms.map((r) => {
        const roomCams = cameras.filter((c) => c.roomId === r.id);
        const offline = roomCams.filter((c) => c.status === 'offline').length;
        const alert = worstActive(events.filter((e) => e.roomId === r.id));
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={value === r.id}
            className="kb-room"
            data-active={value === r.id || undefined}
            onClick={() => onChange(r.id)}
          >
            <span className="kb-room-name">
              <span
                className={`kb-room-dot ${alert ? alert.severity : offline ? 'offline' : 'ok'}`}
                aria-label={
                  alert ? SEVERITY_LABEL[alert.severity] : offline ? 'Есть камеры не в сети' : 'Нарушений нет'
                }
              />
              {r.name}
            </span>
            <span className="kb-room-meta">
              {r.purpose} · {roomCams.length} кам.
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RoomSection({
  room,
  cameras,
  events,
  rules,
  onOpen,
}: {
  room: Room;
  cameras: Camera[];
  events: VideoEvent[];
  rules: Map<string, Rule>;
  onOpen: (c: Camera) => void;
}) {
  const active = events.filter(isActive);
  const gross = active.filter((e) => e.severity === 'gross').length;
  return (
    <section className="kb-card" aria-label={room.name}>
      <Group justify="space-between" mb="sm" gap="xs">
        <div>
          <div className="kb-card-title">{room.name}</div>
          <div className="kb-card-sub">
            {room.purpose} · камер: {cameras.length}
          </div>
        </div>
        {active.length > 0 ? (
          <Badge color={gross ? 'red' : 'orange'} variant={gross ? 'filled' : 'light'}>
            {gross ? `Грубых нарушений: ${gross}` : `Нарушений: ${active.length}`}
          </Badge>
        ) : (
          <Badge color="green" variant="light">
            Без нарушений
          </Badge>
        )}
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 3, xl: 4 }} spacing="sm">
        {cameras.map((c) => (
          <CameraTile
            key={c.id}
            camera={c}
            events={events.filter((e) => e.cameraId === c.id)}
            rules={rules}
            onOpen={() => onOpen(c)}
          />
        ))}
      </SimpleGrid>
    </section>
  );
}

// ---------- журнал ----------

function ReviewCell({ event }: { event: VideoEvent }) {
  const review = useReviewEvent();
  const mark = (r: Review) => review.mutate({ id: event.id, review: r });
  if (event.review === 'confirmed') {
    return (
      <Badge size="sm" variant="light" color="gray" leftSection={<IconCheck size={12} />}>
        Подтверждено
      </Badge>
    );
  }
  if (event.review === 'false') {
    return (
      <Badge size="sm" variant="light" color="gray" leftSection={<IconX size={12} />}>
        Ложное
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Подтвердить нарушение">
        <ActionIcon
          size="sm"
          variant="light"
          color="green"
          aria-label="Подтвердить нарушение"
          onClick={() => mark('confirmed')}
        >
          <IconCheck size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Ложное срабатывание">
        <ActionIcon
          size="sm"
          variant="light"
          color="gray"
          aria-label="Ложное срабатывание"
          onClick={() => mark('false')}
        >
          <IconX size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function EventLog({
  data,
  roomId,
  cameraId,
  compact,
}: {
  data: VideoOverview;
  roomId?: string | null;
  cameraId?: string;
  compact?: boolean;
}) {
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const rooms = useMemo(() => new Map(data.rooms.map((r) => [r.id, r])), [data.rooms]);
  const cameras = useMemo(() => new Map(data.cameras.map((c) => [c.id, c])), [data.cameras]);
  const rules = useMemo(() => new Map(data.rules.map((r) => [r.id, r])), [data.rules]);

  const shown = data.events.filter(
    (e) =>
      (!roomId || e.roomId === roomId) &&
      (!cameraId || e.cameraId === cameraId) &&
      (severity === 'all' || e.severity === severity),
  );

  return (
    <Stack gap="sm">
      {!compact && (
        <Group justify="space-between" gap="sm">
          <div>
            <div className="kb-card-title">Журнал нарушений</div>
            <div className="kb-card-sub">
              {roomId ? `${rooms.get(roomId)?.name ?? ''} · ` : ''}Отметьте ложные срабатывания — на них ИИ дообучается
            </div>
          </div>
          <SegmentedControl
            size="xs"
            value={severity}
            onChange={(v) => setSeverity(v as SeverityFilter)}
            data={[
              { value: 'all', label: 'Все' },
              { value: 'gross', label: 'Грубые' },
              { value: 'violation', label: 'Нарушения' },
              { value: 'notice', label: 'Замечания' },
            ]}
            aria-label="Уровень нарушения"
          />
        </Group>
      )}
      {shown.length === 0 ? (
        <Empty text="Нарушений не зафиксировано" />
      ) : (
        <Table.ScrollContainer minWidth={compact ? 520 : 760}>
          <Table verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Когда</Table.Th>
                {!cameraId && <Table.Th>Где</Table.Th>}
                <Table.Th>Нарушение</Table.Th>
                <Table.Th>Уровень</Table.Th>
                <Table.Th className="kb-num">Уверенность</Table.Th>
                <Table.Th aria-label="Telegram">
                  <IconBrandTelegram size={16} />
                </Table.Th>
                <Table.Th>Разметка</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((e) => (
                <Table.Tr key={e.id} className={e.review === 'false' ? 'kb-row-muted' : undefined}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Tooltip label={fmtDateTime(e.at)}>
                      <span>{relTime(e.at)}</span>
                    </Tooltip>
                  </Table.Td>
                  {!cameraId && (
                    <Table.Td>
                      <Text size="sm">{rooms.get(e.roomId)?.name}</Text>
                      <Text size="xs" c="dimmed">
                        {cameras.get(e.cameraId)?.name}
                      </Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {rules.get(e.ruleId)?.name ?? e.ruleId}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {e.note}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SeverityBadge severity={e.severity} />
                  </Table.Td>
                  <Table.Td className="kb-num">{Math.round(e.confidence * 100)}%</Table.Td>
                  <Table.Td>
                    {e.telegram === 'sent' && (
                      <Tooltip label="Отправлено в Telegram">
                        <IconBrandTelegram size={16} color="var(--kb-series-1)" aria-label="Отправлено в Telegram" />
                      </Tooltip>
                    )}
                    {e.telegram === 'failed' && (
                      <Tooltip label="Не удалось отправить в Telegram">
                        <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" aria-label="Не отправлено" />
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ReviewCell event={e} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

// ---------- правила ----------

function RulesCard({ rules, rooms }: { rules: Rule[]; rooms: Room[] }) {
  const roomName = new Map(rooms.map((r) => [r.id, r.name.replace('Помещение ', '№')]));
  const sorted = [...rules].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return (
    <div className="kb-card">
      <div className="kb-card-title">Правила ИИ</div>
      <div className="kb-card-sub">
        Что ИИ ищет в кадре. Всё найденное пишется в журнал, грубые нарушения сразу уходят в Telegram-бот.
      </div>
      <Stack gap={10} mt="sm">
        {sorted.map((r) => (
          <div key={r.id} className="kb-rule">
            <Group gap={6} wrap="nowrap" justify="space-between">
              <Text size="sm" fw={600}>
                {r.name}
              </Text>
              <Group gap={4} wrap="nowrap">
                {r.severity === 'gross' && (
                  <Tooltip label="Сразу отправляется в Telegram">
                    <IconBrandTelegram size={16} color="var(--kb-series-1)" aria-label="Отправляется в Telegram" />
                  </Tooltip>
                )}
                <SeverityBadge severity={r.severity} />
              </Group>
            </Group>
            <Text size="xs" c="dimmed">
              {r.description}
            </Text>
            <Text size="xs" c="dimmed">
              {r.roomIds.length
                ? `Помещения ${r.roomIds.map((id) => roomName.get(id) ?? id).join(', ')}`
                : 'Все помещения'}
            </Text>
          </div>
        ))}
      </Stack>
    </div>
  );
}

// ---------- страница ----------

function CameraModal({ camera, data, onClose }: { camera: Camera | null; data: VideoOverview; onClose: () => void }) {
  const room = data.rooms.find((r) => r.id === camera?.roomId);
  const rules = useMemo(() => new Map(data.rules.map((r) => [r.id, r])), [data.rules]);
  const events = camera ? data.events.filter((e) => e.cameraId === camera.id) : [];
  const alert = worstActive(events);
  return (
    <Modal
      opened={camera !== null}
      onClose={onClose}
      size="xl"
      title={camera ? `${room?.name ?? ''} · ${camera.name}` : ''}
    >
      {camera && (
        <Stack gap="md">
          <div className={`kb-cam large${alert ? ` alert ${alert.severity}` : ''}`}>
            <CameraScreen camera={camera} alert={alert} rule={alert ? rules.get(alert.ruleId) : undefined} />
          </div>
          <EventLog data={data} cameraId={camera.id} compact />
        </Stack>
      )}
    </Modal>
  );
}

export function VideoMonitoringPage() {
  const overview = useVideoOverview();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Camera | null>(null);

  const rules = useMemo(() => new Map((overview.data?.rules ?? []).map((r) => [r.id, r])), [overview.data?.rules]);

  if (overview.isPending) return <Loading height={240} />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;

  const data = overview.data;
  const online = data.cameras.filter((c) => c.status === 'online').length;
  const day = data.events.filter((e) => Date.now() - new Date(e.at).getTime() <= DAY_MS && e.review !== 'false');
  const gross = day.filter((e) => e.severity === 'gross');
  const pending = data.events.filter((e) => e.review === 'pending').length;
  const shownRooms = roomId ? data.rooms.filter((r) => r.id === roomId) : data.rooms;

  return (
    <Stack gap="md">
      {data.demo && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} p="sm">
          Демонстрационный режим: камеры ещё не подключены, данные ниже показывают, как будет работать раздел. После
          подключения здесь будут живые потоки, а ИИ начнёт фиксировать нарушения по правилам.
        </Alert>
      )}

      {/* Полоса на четыре показателя, а не на шесть, как на «Обзоре» */}
      <div className="kb-stats kb-stats-4">
        <StatStripContents
          online={online}
          total={data.cameras.length}
          day={day.length}
          gross={gross.length}
          telegram={gross.filter((e) => e.telegram === 'sent').length}
          pending={pending}
        />
      </div>

      <RoomPicker rooms={data.rooms} cameras={data.cameras} events={data.events} value={roomId} onChange={setRoomId} />

      {shownRooms.map((r) => (
        <RoomSection
          key={r.id}
          room={r}
          cameras={data.cameras.filter((c) => c.roomId === r.id)}
          events={data.events.filter((e) => e.roomId === r.id)}
          rules={rules}
          onOpen={setOpened}
        />
      ))}

      <div className="kb-video-bottom">
        <div className="kb-card">
          <EventLog data={data} roomId={roomId} />
        </div>
        <RulesCard rules={data.rules} rooms={data.rooms} />
      </div>

      <CameraModal camera={opened} data={data} onClose={() => setOpened(null)} />
    </Stack>
  );
}

function StatStripContents(p: {
  online: number;
  total: number;
  day: number;
  gross: number;
  telegram: number;
  pending: number;
}) {
  return (
    <>
      <StatTile
        label="Камеры в сети"
        value={`${p.online} из ${p.total}`}
        hint={p.online < p.total ? `Не в сети: ${p.total - p.online}` : 'Все работают'}
      />
      <StatTile label="Нарушений за сутки" value={fmt(p.day)} hint={`Грубых: ${fmt(p.gross)}`} />
      <StatTile label="Отправлено в Telegram" value={fmt(p.telegram)} hint="Грубые нарушения за сутки" />
      <StatTile label="Ждут разметки" value={fmt(p.pending)} hint="Подтвердите или отклоните для обучения ИИ" />
    </>
  );
}
