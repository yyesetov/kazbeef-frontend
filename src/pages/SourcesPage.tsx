import type { ReactNode } from 'react';
import { Badge, Button, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  errorMessage,
  get,
  queryKeys,
  send,
  type CollectorSource,
  type RunStatus,
  type SystemState,
} from '../api';
import { TrustBadge } from '../components/badges';
import { Empty, ErrorState, Loading } from '../components/states';
import { fmt, fmtDateTime } from '../lib/format';

const RUN_COLOR: Record<RunStatus, string> = { SUCCESS: 'green', PARTIAL: 'yellow', FAILED: 'red', RUNNING: 'blue' };
const RUN_LABEL: Record<RunStatus, string> = {
  SUCCESS: 'Успешно',
  PARTIAL: 'Частично',
  FAILED: 'Ошибка',
  RUNNING: 'Выполняется',
};

const SHOWN_RUNS = 6;
/** Пока сборщик работает, состояние обновляется часто; в покое — редко. */
const POLL_RUNNING_MS = 3_000;
const POLL_IDLE_MS = 30_000;

/** Служебное действие администратора: POST без тела; run возвращает сообщение для пользователя. */
type SystemAction = { path: string; run: () => Promise<string> };

/** Тип ответа у каждого действия свой, поэтому сообщение по нему строится сразу при описании действия. */
const systemAction = <T,>(path: string, describe: (body: T) => string): SystemAction => ({
  path,
  run: async () => describe(await send<T>(path, 'POST')),
});

const AI_RUN = systemAction<{ processed: number }>('/admin/ai/run', (b) => `Обработано событий: ${b.processed}`);
const NOTIFY_TEST = systemAction<Record<string, string>>('/admin/notify/test', (b) =>
  Object.entries(b)
    .map(([channel, result]) => `${channel}: ${result === 'ok' ? 'отправлено' : result}`)
    .join('; '),
);
const NOTIFY_DIGEST = systemAction<{ sent: number }>(
  '/admin/notify/digest',
  (b) => `Дайджест отправлен, каналов: ${b.sent}`,
);

function useSystemAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: SystemAction) => action.run(),
    onSuccess: (message) => notifications.show({ message, color: 'green', autoClose: 8000 }),
    onError: (e) => notifications.show({ message: errorMessage(e), color: 'red', autoClose: 8000 }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.system }),
  });
}

function useRunCollector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => send(`/admin/collectors/${encodeURIComponent(code)}/run`, 'POST'),
    onSuccess: (_, code) => notifications.show({ message: `Сбор данных ${code} запущен`, color: 'blue' }),
    onError: (e, code) =>
      e instanceof ApiError && e.status === 409
        ? notifications.show({ message: `Сборщик ${code} уже выполняется`, color: 'yellow' })
        : notifications.show({ message: `Не удалось запустить ${code}: ${errorMessage(e)}`, color: 'red' }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.collectors }),
  });
}

function SystemCard({
  title,
  badge,
  children,
  actions,
}: {
  title: string;
  badge: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="kb-card">
      {/* Текст сжимается и переносится, кнопки — нет; на узком экране кнопки уходят под текст */}
      <Group justify="space-between" align="flex-start">
        <div style={{ flex: 1, minWidth: 200 }}>
          <Group gap={8}>
            <Text fw={600}>{title}</Text>
            {badge}
          </Group>
          {children}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </Group>
    </div>
  );
}

function SystemPanel() {
  const system = useQuery({
    queryKey: queryKeys.system,
    queryFn: ({ signal }) => get<SystemState>('/admin/system', signal),
    refetchInterval: POLL_IDLE_MS,
  });
  const action = useSystemAction();
  const running = (a: SystemAction) => action.isPending && action.variables === a;

  if (system.isPending) return <Loading />;
  if (system.isError) return <ErrorState error={system.error} onRetry={() => void system.refetch()} />;

  const { ai, notify } = system.data;
  const hasChannels = notify.channels.length > 0;

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      <SystemCard
        title="ИИ: перевод и резюме"
        badge={
          <Badge size="sm" variant="light" color={ai.enabled ? 'green' : 'gray'}>
            {ai.enabled ? 'Включён' : 'Выключен'}
          </Badge>
        }
        actions={
          ai.enabled && (
            <Button size="xs" variant="default" loading={running(AI_RUN)} onClick={() => action.mutate(AI_RUN)}>
              Обработать сейчас
            </Button>
          )
        }
      >
        <Text size="sm" c="dimmed">
          {ai.enabled
            ? `Модель ${ai.model}. Обработано событий: ${fmt(ai.processed)} из ${fmt(ai.total)}. Очередь разбирается каждые 10 минут.`
            : 'Чтобы включить, задайте ANTHROPIC_API_KEY в .env бэкенда и перезапустите сервис.'}
        </Text>
      </SystemCard>

      <SystemCard
        title="Оповещения"
        badge={
          <Badge size="sm" variant="light" color={hasChannels ? 'green' : 'gray'}>
            {hasChannels ? notify.channels.join(', ') : 'Не настроены'}
          </Badge>
        }
        actions={
          hasChannels && (
            <Group gap={6} wrap="nowrap">
              <Button
                size="xs"
                variant="default"
                loading={running(NOTIFY_TEST)}
                onClick={() => action.mutate(NOTIFY_TEST)}
              >
                Проверить
              </Button>
              <Button
                size="xs"
                variant="default"
                loading={running(NOTIFY_DIGEST)}
                onClick={() => action.mutate(NOTIFY_DIGEST)}
              >
                Дайджест
              </Button>
            </Group>
          )
        }
      >
        <Text size="sm" c="dimmed">
          {hasChannels
            ? `Отправлено оповещений: ${fmt(notify.alertsSent)}. Дайджест уходит ежедневно в 09:00 по Алматы.`
            : 'Чтобы включить, задайте в .env бэкенда TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID или параметры почты (SMTP_HOST, KAZBEEF_ALERT_EMAIL_TO).'}
        </Text>
        {notify.lastError && (
          <Text size="xs" c="red" lineClamp={2}>
            Последняя ошибка: {notify.lastError}
          </Text>
        )}
      </SystemCard>
    </SimpleGrid>
  );
}

function CollectorCard({
  source: s,
  onRun,
  starting,
}: {
  source: CollectorSource;
  onRun: () => void;
  starting: boolean;
}) {
  const connected = s.active && s.hasCollector;
  const state = s.running ? (
    <Badge size="sm" color="blue">
      Выполняется
    </Badge>
  ) : (
    <Badge size="sm" color={connected ? 'green' : 'gray'} variant="light">
      {connected ? 'Подключён' : 'Не подключён'}
    </Badge>
  );

  const runs = s.recentRuns.slice(0, SHOWN_RUNS);

  return (
    <div className="kb-card">
      <Group justify="space-between" align="flex-start">
        <div style={{ flex: 1, minWidth: 200 }}>
          <Group gap={8}>
            <Text fw={600}>{s.code}</Text>
            <TrustBadge level={s.trustLevel} />
            {state}
          </Group>
          <Text size="sm" c="dimmed">
            {s.name}
          </Text>
          <Text size="xs" c="dimmed">
            Последний успешный сбор: {fmtDateTime(s.lastSuccessAt)}
          </Text>
        </div>
        {s.hasCollector && (
          <Button size="xs" leftSection={<IconPlayerPlay size={14} />} loading={s.running || starting} onClick={onRun}>
            Собрать данные
          </Button>
        )}
      </Group>
      {s.note && (
        <Text size="sm" mt="xs">
          {s.note}
        </Text>
      )}

      {runs.length > 0 && (
        <Table.ScrollContainer minWidth={420} mt="sm">
          <Table fz="xs" verticalSpacing={3}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Начало</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th className="kb-num">Прочитано</Table.Th>
                <Table.Th className="kb-num">Новых</Table.Th>
                <Table.Th className="kb-num">Обновлено</Table.Th>
                <Table.Th className="kb-num">Ошибок</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {runs.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{fmtDateTime(r.startedAt)}</Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge size="xs" variant="light" color={RUN_COLOR[r.status] ?? 'gray'}>
                        {RUN_LABEL[r.status] ?? r.status}
                      </Badge>
                      {r.error && (
                        <Text size="xs" c="dimmed" lineClamp={3} title={r.error}>
                          {r.error}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td className="kb-num">{fmt(r.fetched)}</Table.Td>
                  <Table.Td className="kb-num">{fmt(r.created)}</Table.Td>
                  <Table.Td className="kb-num">{fmt(r.updated)}</Table.Td>
                  <Table.Td className="kb-num">{fmt(r.failed)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </div>
  );
}

function CollectorsPanel() {
  const collectors = useQuery({
    queryKey: queryKeys.collectors,
    queryFn: ({ signal }) => get<CollectorSource[]>('/admin/collectors', signal),
    refetchInterval: (q) => (q.state.data?.some((s) => s.running) ? POLL_RUNNING_MS : POLL_IDLE_MS),
  });
  const run = useRunCollector();

  if (collectors.isPending) return <Loading />;
  if (collectors.isError) return <ErrorState error={collectors.error} onRetry={() => void collectors.refetch()} />;
  if (!collectors.data.length) return <Empty text="Источники не заведены" />;

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      {collectors.data.map((s) => (
        <CollectorCard
          key={s.code}
          source={s}
          onRun={() => run.mutate(s.code)}
          starting={run.isPending && run.variables === s.code}
        />
      ))}
    </SimpleGrid>
  );
}

export function SourcesPage() {
  return (
    <Stack gap="md">
      <SystemPanel />
      <CollectorsPanel />
    </Stack>
  );
}
