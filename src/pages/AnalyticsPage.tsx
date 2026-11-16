import { useMemo, useState } from 'react';
import { Grid, Group, SegmentedControl, Stack } from '@mantine/core';
import {
  useSlice,
  type AggRow,
  type Interval,
  type MatrixRow,
  type Metric,
  type SeriesRow,
  type SourceAggRow,
  type SpeciesAggRow,
} from '../api';
import { ChartCard } from '../components/ChartCard';
import { DataTable, type Column } from '../components/DataTable';
import { HeatTable } from '../components/HeatTable';
import { RankedBars } from '../components/RankedBars';
import { StackedTimeChart } from '../components/StackedTimeChart';
import { fmtDate } from '../lib/format';
import { COUNTRY_SLOTS, GROUP_LABEL, TRUST_LABEL } from '../theme';
import { INTERVAL_OPTIONS, METRIC_OPTIONS, METRIC_UNIT } from './options';

const SERIES_COLUMNS: Column<SeriesRow>[] = [
  { key: 'period', label: 'Период', render: (r) => fmtDate(r.period) },
  { key: 'label', label: 'Страна' },
  { key: 'events', label: 'События', numeric: true },
  { key: 'outbreaks', label: 'Очаги', numeric: true },
  { key: 'cases', label: 'Случаи', numeric: true },
  { key: 'deaths', label: 'Падёж', numeric: true },
];

const DISEASE_COLUMNS: Column<AggRow>[] = [
  { key: 'label', label: 'Болезнь' },
  { key: 'events', label: 'События', numeric: true },
  { key: 'active', label: 'Активные', numeric: true },
  { key: 'outbreaks', label: 'Очаги', numeric: true },
  { key: 'cases', label: 'Случаи', numeric: true },
  { key: 'deaths', label: 'Падёж', numeric: true },
  { key: 'maxRisk', label: 'Макс. риск', numeric: true },
];

export function AnalyticsPage() {
  const [interval, setChartInterval] = useState<Interval>('month');
  const [metric, setMetric] = useState<Metric>('events');

  const series = useSlice<SeriesRow[]>('/api/stats/timeseries', `interval=${interval}&by=country`);
  const matrix = useSlice<MatrixRow[]>('/api/stats/matrix');
  const bySpecies = useSlice<SpeciesAggRow[]>('/api/stats/by-species');
  const bySource = useSlice<SourceAggRow[]>('/api/stats/by-source');
  const byDisease = useSlice<AggRow[]>('/api/stats/by-disease');

  const species = useMemo(
    () => (bySpecies.data ?? []).map((r) => ({ ...r, label: `${r.label} · ${GROUP_LABEL[r.group] ?? r.group}` })),
    [bySpecies.data],
  );
  const sources = useMemo(
    () =>
      (bySource.data ?? []).map((r) => ({ ...r, label: `${r.key} · ${TRUST_LABEL[r.trustLevel] ?? r.trustLevel}` })),
    [bySource.data],
  );
  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label.toLowerCase() ?? '';

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          data={METRIC_OPTIONS}
          aria-label="Показатель"
        />
      </Group>
      <Grid gutter="md">
        <Grid.Col span={12}>
          <ChartCard
            title={`Динамика по странам: ${metricLabel}`}
            subtitle={interval === 'week' ? 'По неделям начала вспышки' : 'По месяцам начала вспышки'}
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
            <StackedTimeChart
              rows={series.data ?? []}
              slots={COUNTRY_SLOTS}
              metric={metric}
              interval={interval}
              height={320}
            />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <ChartCard
            title="Болезнь × страна"
            subtitle={`Чем темнее ячейка, тем больше ${METRIC_UNIT[metric]}`}
            query={matrix}
          >
            <HeatTable rows={matrix.data ?? []} metric={metric} />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard title="Поражённые виды" subtitle="Событие с несколькими видами учтено в каждом" query={bySpecies}>
            <RankedBars rows={species} metric={metric} unit={METRIC_UNIT[metric]} limit={12} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ChartCard
            title="Источники"
            subtitle="Событие, подтверждённое несколькими источниками, учтено в каждом"
            query={bySource}
          >
            <RankedBars rows={sources} metric={metric} unit={METRIC_UNIT[metric]} />
          </ChartCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <ChartCard title="Сводка по болезням" query={byDisease}>
            <DataTable columns={DISEASE_COLUMNS} rows={byDisease.data ?? []} />
          </ChartCard>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
