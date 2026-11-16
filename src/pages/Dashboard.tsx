import { useMemo, useState } from 'react';
import { Grid, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import {
  useReference,
  useSlice,
  type AggRow,
  type EventPage,
  type Interval,
  type MapPoint,
  type SeriesRow,
  type Summary,
} from '../api';
import { RiskBadge, StatusBadge } from '../components/badges';
import { ChartCard } from '../components/ChartCard';
import type { Column } from '../components/DataTable';
import { EventDrawer } from '../components/EventDrawer';
import { EventMap } from '../components/EventMap';
import { RankedBars } from '../components/RankedBars';
import { StackedTimeChart } from '../components/StackedTimeChart';
import { Empty, ErrorState } from '../components/states';
import { StatStrip, StatTile } from '../components/StatTile';
import { useFilters } from '../filters/useFilters';
import { fmt, fmtDate } from '../lib/format';
import { diseaseSlots, riskLevel } from '../theme';
import { INTERVAL_OPTIONS } from './options';

const AGG_COLUMNS: Column<AggRow>[] = [
  { key: 'label', label: 'Название' },
  { key: 'events', label: 'События', numeric: true },
  { key: 'active', label: 'Активные', numeric: true },
  { key: 'outbreaks', label: 'Очаги', numeric: true },
  { key: 'cases', label: 'Случаи', numeric: true },
  { key: 'deaths', label: 'Падёж', numeric: true },
];

const SERIES_COLUMNS: Column<SeriesRow>[] = [
  { key: 'period', label: 'Период', render: (r) => fmtDate(r.period) },
  { key: 'label', label: 'Болезнь' },
  { key: 'events', label: 'События', numeric: true },
  { key: 'outbreaks', label: 'Очаги', numeric: true },
  { key: 'cases', label: 'Случаи', numeric: true },
];

export function Dashboard() {
  const { filters, set } = useFilters();
  const { data: ref } = useReference();
  const [interval, setChartInterval] = useState<Interval>('week');
  const [selected, setSelected] = useState<number | null>(null);

  const summary = useSlice<Summary>('/api/stats/summary');
  const series = useSlice<SeriesRow[]>('/api/stats/timeseries', `interval=${interval}&by=disease`);
  const byDisease = useSlice<AggRow[]>('/api/stats/by-disease');
  const byCountry = useSlice<AggRow[]>('/api/stats/by-country');
  const map = useSlice<MapPoint[]>('/api/map');
  const latest = useSlice<EventPage>('/api/events', 'size=8&sort=reportDate&dir=desc');

  const s = summary.data;
  const points = map.data ?? [];
  const latestItems = latest.data?.items ?? [];
  // Стабильная ссылка: график не пересчитывается на каждую отрисовку страницы
  const slots = useMemo(() => diseaseSlots(ref), [ref]);

  const toggle = (key: 'countries' | 'diseases', value: string | null) => {
    if (value === null) return; // строка «Не указана» не имеет ключа: фильтровать нечем
    const current = filters[key];
    set({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };

  return (
    <Stack gap="md">
      {summary.isError && <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />}
      <StatStrip>
        <StatTile label="События" value={fmt(s?.events)} hint={`активных ${fmt(s?.active)}`} />
        <StatTile
          label="Новые за 7 дней"
          value={fmt(s?.newLast7d)}
          hint={s?.lastReportDate ? `последний отчёт ${fmtDate(s.lastReportDate)}` : undefined}
        />
        <StatTile
          label="В Казахстане"
          value={fmt(s?.inKazakhstan)}
          hint={`в зоне 300 км от границы ${fmt(s?.nearBorder)}`}
        />
        <StatTile
          label="Очаги"
          value={fmt(s?.outbreaks)}
          hint={`стран ${fmt(s?.countries)}, болезней ${fmt(s?.diseases)}`}
        />
        <StatTile label="Случаи" value={fmt(s?.cases)} hint={`падёж ${fmt(s?.deaths)}`} />
        <StatTile
          label="Максимальный риск"
          value={s?.maxRisk ?? '—'}
          marker={riskLevel(s?.maxRisk).color}
          hint={riskLevel(s?.maxRisk).label}
        />
      </StatStrip>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <ChartCard title="Карта очагов" subtitle={`${fmt(points.length)} событий с координатами`} query={map}>
            <EventMap points={points} height={420} onSelect={setSelected} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <ChartCard title="Последние сообщения" subtitle="По дате отчёта" query={latest}>
            {!latestItems.length ? (
              <Empty />
            ) : (
              <Stack gap={10}>
                {latestItems.map((e) => (
                  <button key={e.id} type="button" className="kb-list-item" onClick={() => setSelected(e.id)}>
                    <Group justify="space-between" wrap="nowrap" gap={8}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {e.disease}
                      </Text>
                      <StatusBadge status={e.status} />
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {fmtDate(e.reportDate)} · {e.country}
                      {e.region ? ` · ${e.region}` : ''}
                    </Text>
                    <Text size="xs" component="div">
                      <RiskBadge score={e.riskScore} />
                    </Text>
                  </button>
                ))}
              </Stack>
            )}
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <ChartCard
            title="Динамика событий по болезням"
            subtitle={
              interval === 'week'
                ? 'Число событий по неделям начала вспышки'
                : 'Число событий по месяцам начала вспышки'
            }
            right={
              <SegmentedControl
                size="xs"
                value={interval}
                onChange={(v) => setChartInterval(v as Interval)}
                data={INTERVAL_OPTIONS}
                aria-label="Шаг по времени"
              />
            }
            table={{ columns: SERIES_COLUMNS, rows: series.data ?? [] }}
            query={series}
          >
            <StackedTimeChart rows={series.data ?? []} slots={slots} interval={interval} />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard
            title="Болезни"
            subtitle="Число событий; нажмите, чтобы отфильтровать"
            table={{ columns: AGG_COLUMNS, rows: byDisease.data ?? [] }}
            query={byDisease}
          >
            <RankedBars rows={byDisease.data ?? []} onSelect={(r) => toggle('diseases', r.key)} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard
            title="Страны"
            subtitle="Число событий; нажмите, чтобы отфильтровать"
            table={{ columns: AGG_COLUMNS, rows: byCountry.data ?? [] }}
            query={byCountry}
          >
            <RankedBars rows={byCountry.data ?? []} onSelect={(r) => toggle('countries', r.key)} />
          </ChartCard>
        </Grid.Col>
      </Grid>

      <EventDrawer id={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
