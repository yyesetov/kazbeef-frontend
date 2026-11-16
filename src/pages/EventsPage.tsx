import { useState, type KeyboardEvent } from 'react';
import { Group, Pagination, ScrollArea, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useSlice, type EventItem, type EventPage } from '../api';
import { RiskBadge, StatusBadge, TrustBadge } from '../components/badges';
import { EventDrawer } from '../components/EventDrawer';
import { ExportMenu } from '../components/ExportMenu';
import { Empty, ErrorState, Loading } from '../components/states';
import { useFilters } from '../filters/useFilters';
import { fmt, fmtDate } from '../lib/format';

const PAGE_SIZE = 50;

/** Ключи сортировки, которые понимает бэкенд (EventQueries.SORT). */
type SortKey = 'eventDate' | 'country' | 'disease' | 'status' | 'riskScore' | 'outbreaks' | 'cases' | 'deaths';
type SortDir = 'asc' | 'desc';

type EventColumn = { key: string; label: string; numeric?: boolean; sort?: SortKey };

const COLUMNS: EventColumn[] = [
  { key: 'eventDate', label: 'Дата', sort: 'eventDate' },
  { key: 'country', label: 'Страна', sort: 'country' },
  { key: 'disease', label: 'Болезнь', sort: 'disease' },
  { key: 'species', label: 'Виды' },
  { key: 'region', label: 'Регион' },
  { key: 'status', label: 'Статус', sort: 'status' },
  { key: 'riskScore', label: 'Риск', sort: 'riskScore' },
  { key: 'outbreaks', label: 'Очаги', numeric: true, sort: 'outbreaks' },
  { key: 'cases', label: 'Случаи', numeric: true, sort: 'cases' },
  { key: 'deaths', label: 'Падёж', numeric: true, sort: 'deaths' },
  { key: 'sources', label: 'Источники' },
];

/** Текст удобнее читать от А до Я, числа и даты — от больших к меньшим. */
const TEXT_SORT: SortKey[] = ['country', 'disease', 'status'];

function EventRow({ e, onOpen }: { e: EventItem; onOpen: (id: number) => void }) {
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onOpen(e.id);
    }
  };
  return (
    <Table.Tr
      className="kb-row"
      onClick={() => onOpen(e.id)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={`Открыть карточку: ${e.disease}, ${e.country}, ${fmtDate(e.eventDate)}`}
    >
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.eventDate)}</Table.Td>
      <Table.Td>{e.country}</Table.Td>
      <Table.Td>
        <Text size="sm" fw={500}>
          {e.disease}
        </Text>
        {e.aiSummary && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {e.aiSummary}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {e.species ?? (
          <Text span c="dimmed" size="xs">
            {e.rawSpecies ?? '—'}
          </Text>
        )}
      </Table.Td>
      <Table.Td maw={220}>
        <Text size="sm" lineClamp={2}>
          {e.region ?? '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        <StatusBadge status={e.status} />
      </Table.Td>
      <Table.Td>
        <RiskBadge score={e.riskScore} />
      </Table.Td>
      <Table.Td className="kb-num">{fmt(e.outbreaks)}</Table.Td>
      <Table.Td className="kb-num">{fmt(e.cases)}</Table.Td>
      <Table.Td className="kb-num">{fmt(e.deaths)}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Text size="xs">{(e.sources ?? '').replaceAll(',', ', ')}</Text>
          {e.trustLevel !== 'confirmed' && <TrustBadge level={e.trustLevel} />}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export function EventsPage() {
  const { query } = useFilters();
  // Страница привязана к срезу: сменился фильтр — снова первая, без лишнего запроса со старым номером
  const [paging, setPaging] = useState({ query, page: 1 });
  const page = paging.query === query ? paging.page : 1;
  const setPage = (next: number) => setPaging({ query, page: next });

  const [sort, setSort] = useState<SortKey>('eventDate');
  const [dir, setDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<number | null>(null);

  const events = useSlice<EventPage>('/api/events', `page=${page - 1}&size=${PAGE_SIZE}&sort=${sort}&dir=${dir}`);
  const items = events.data?.items ?? [];
  const total = events.data?.total ?? 0;

  const sortBy = (key: SortKey) => {
    if (key === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDir(TEXT_SORT.includes(key) ? 'asc' : 'desc');
    }
    setPage(1);
  };

  let body;
  if (events.isPending) body = <Loading height={240} />;
  else if (events.isError) body = <ErrorState error={events.error} onRetry={() => void events.refetch()} />;
  else if (!items.length) body = <Empty />;
  else
    body = (
      <ScrollArea style={{ opacity: events.isPlaceholderData ? 0.6 : 1 }} aria-busy={events.isPlaceholderData}>
        <Table highlightOnHover verticalSpacing={6} fz="sm" miw={1100}>
          <Table.Thead>
            <Table.Tr>
              {COLUMNS.map((c) => {
                const active = c.sort !== undefined && c.sort === sort;
                const sortKey = c.sort;
                return (
                  <Table.Th
                    key={c.key}
                    className={c.numeric ? 'kb-num' : undefined}
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {sortKey ? (
                      <UnstyledButton className="kb-th-sort" onClick={() => sortBy(sortKey)}>
                        {c.label}
                        {active && (dir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />)}
                      </UnstyledButton>
                    ) : (
                      c.label
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((e) => (
              <EventRow key={e.id} e={e} onOpen={setSelected} />
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    );

  return (
    <div className="kb-card">
      <Group justify="space-between" mb="sm">
        <div>
          <div className="kb-card-title">События</div>
          <div className="kb-card-sub">Найдено: {fmt(total)}. Нажмите на строку, чтобы открыть карточку.</div>
        </div>
        <ExportMenu />
      </Group>

      {body}

      {total > PAGE_SIZE && (
        <Group justify="center" mt="md">
          <Pagination size="sm" total={Math.ceil(total / PAGE_SIZE)} value={page} onChange={setPage} />
        </Group>
      )}
      <EventDrawer id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
