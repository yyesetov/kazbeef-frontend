import { useMemo } from 'react';
// esm, а не lib: у CommonJS-сборки пакета default-импорт зависит от сборщика
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { BarChart, type BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { ComposeOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { Interval, SeriesRow } from '../api';
import { fmt } from '../lib/format';
import { periodLabel, stackSeries } from '../lib/series';
import { useChartTheme, type Slots } from '../theme';
import { Empty } from './states';

// Подключаем только то, что рисуем: в сборку не попадает остальная библиотека
echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

type Option = ComposeOption<BarSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption>;

/**
 * Столбцы по периодам с разбивкой на ряды. Цвета закреплены за сущностями через slots;
 * ряды вне слотов складываются в «Прочие».
 */
export function StackedTimeChart({
  rows,
  slots,
  metric = 'events',
  height = 300,
  interval = 'week',
}: {
  rows: SeriesRow[];
  /** Должен быть стабильным между отрисовками (useMemo или константа), иначе график пересчитывается зря */
  slots: Slots;
  metric?: 'events' | 'outbreaks' | 'cases' | 'deaths';
  height?: number;
  interval?: Interval;
}) {
  const t = useChartTheme();

  const option = useMemo<Option>(() => {
    const { periods, series } = stackSeries(rows, slots, metric, interval);
    const single = series.length === 1;
    return {
      animationDuration: 300,
      grid: { left: 8, right: 12, top: 12, bottom: single ? 8 : 44, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
        },
        backgroundColor: t.surface,
        borderColor: t.axis,
        textStyle: { color: t.ink, fontSize: 12 },
        valueFormatter: (v) => fmt(Number(v)),
      },
      legend: single
        ? undefined
        : {
            bottom: 0,
            type: 'scroll',
            icon: 'roundRect',
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: t.ink2, fontSize: 12 },
            pageTextStyle: { color: t.ink2 },
          },
      xAxis: {
        type: 'category',
        data: periods,
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
        axisLabel: {
          color: t.muted,
          fontSize: 11,
          formatter: (v: string) => periodLabel(v, interval),
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: {
          color: t.muted,
          fontSize: 11,
          formatter: (v: number) => (v >= 10000 ? `${v / 1000}K` : fmt(v)),
        },
        splitLine: { lineStyle: { color: t.grid, type: 'solid' } },
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        barMaxWidth: 24,
        // зазор цвета поверхности между сегментами вместо обводки
        itemStyle: {
          color: s.slot === null ? t.other : (t.series[s.slot] ?? t.other),
          borderColor: t.surface,
          borderWidth: 1,
          borderRadius: single ? [4, 4, 0, 0] : 0,
        },
        emphasis: { focus: 'series' },
        data: s.data,
      })),
    };
  }, [rows, slots, metric, interval, t]);

  if (!rows.length) return <Empty />;
  return <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height }} />;
}
