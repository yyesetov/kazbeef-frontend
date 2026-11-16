import type { ReactNode } from 'react';
import { Accordion, Alert, Anchor, Badge, Drawer, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconExternalLink, IconRobot } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { get, queryKeys, type EventDetail } from '../api';
import { fmt, fmtDate } from '../lib/format';
import { RiskBadge, StatusBadge, TrustBadge } from './badges';
import { ErrorState, Loading } from './states';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div">
        {children}
      </Text>
    </div>
  );
}

function prettyJson(raw: string | null) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function distanceText(km: number | null) {
  if (km == null) return '—';
  return km > 0 ? `${fmt(km)} км` : 'внутри страны';
}

function EventCard({ e }: { e: EventDetail }) {
  return (
    <Stack gap="md">
      <div>
        <Title order={4}>{e.disease}</Title>
        <Text size="sm" c="dimmed">
          {e.country}
          {e.region ? ` · ${e.region}` : ''}
        </Text>
        <Group gap={6} mt={8}>
          <StatusBadge status={e.status} />
          <TrustBadge level={e.trustLevel} />
          {e.ruminantRelevant && (
            <Badge size="sm" variant="light" color="teal">
              КРС/МРС
            </Badge>
          )}
        </Group>
      </div>

      {e.trustLevel !== 'confirmed' && (
        <Alert color="yellow" variant="light" p="xs">
          {e.trustLevel === 'signal'
            ? 'Это сигнал из неофициального источника, а не подтверждённая вспышка.'
            : 'Это аналитическая публикация, а не сообщение о конкретной вспышке.'}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="sm">
        <Field label="Начало">{fmtDate(e.startDate)}</Field>
        <Field label="Дата отчёта">{fmtDate(e.reportDate)}</Field>
        <Field label="Риск для Казахстана">
          <RiskBadge score={e.riskScore} />
        </Field>
        <Field label="Очаги">{fmt(e.outbreaks)}</Field>
        <Field label="Восприимчивых">{fmt(e.susceptible)}</Field>
        <Field label="До границы РК">{distanceText(e.distanceKm)}</Field>
        <Field label="Случаи">{fmt(e.cases)}</Field>
        <Field label="Падёж">{fmt(e.deaths)}</Field>
        <Field label="Координаты">
          {e.latitude != null && e.longitude != null ? `${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)}` : '—'}
        </Field>
      </SimpleGrid>

      <Field label="Виды животных">
        {e.species ?? '—'}
        {e.rawSpecies && e.rawSpecies !== e.species && (
          <Text size="xs" c="dimmed">
            В источнике: {e.rawSpecies}
          </Text>
        )}
      </Field>

      {e.aiSummary && (
        <Alert color="blue" variant="light" icon={<IconRobot size={18} />} title="Резюме (сгенерировано ИИ)">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {e.aiSummary}
          </Text>
        </Alert>
      )}
      {e.translation && (
        <Field label="Перевод (сгенерирован ИИ)">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {e.translation}
          </Text>
        </Field>
      )}
      <Field label="Оригинал">
        <Text size="sm" fw={500}>
          {e.title ?? '—'}
        </Text>
        {e.description && (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {e.description}
          </Text>
        )}
      </Field>

      <div>
        <Text size="xs" c="dimmed" mb={4}>
          Источники
        </Text>
        <Accordion variant="separated" multiple>
          {(e.sourceRecords ?? []).map((s) => {
            const id = `${s.code}:${s.externalId}`;
            return (
              <Accordion.Item key={id} value={id}>
                <Accordion.Control>
                  <Group gap={8}>
                    <Text size="sm" fw={600}>
                      {s.code}
                    </Text>
                    <TrustBadge level={s.trustLevel} />
                    <Text size="xs" c="dimmed">
                      № {s.externalId} · получено {fmtDate(s.fetchedAt)}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">{s.name}</Text>
                  {s.url && (
                    <Anchor href={s.url} target="_blank" rel="noopener noreferrer" size="sm">
                      Открыть в источнике <IconExternalLink size={12} />
                    </Anchor>
                  )}
                  <Text size="xs" c="dimmed" mt="xs">
                    Исходный ответ источника
                  </Text>
                  <pre className="kb-pre">{prettyJson(s.rawPayload)}</pre>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </div>
    </Stack>
  );
}

/** Выезжающая карточка события. id = null — закрыта. */
export function EventDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: queryKeys.event(id),
    queryFn: ({ signal }) => get<EventDetail>(`/api/events/${id}`, signal),
    enabled: id !== null,
  });

  let body: ReactNode = null;
  if (query.isError) body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  else if (query.data) body = <EventCard e={query.data} />;
  else if (id !== null) body = <Loading height={200} />;

  return (
    <Drawer opened={id !== null} onClose={onClose} position="right" size="xl" title="Карточка события">
      {body}
    </Drawer>
  );
}
