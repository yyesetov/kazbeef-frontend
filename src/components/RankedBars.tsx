import { Tooltip } from '@mantine/core';
import type { Metric } from '../api';
import { fmt } from '../lib/format';
import { Empty } from './states';

type BarRow = {
  key: string | null;
  label: string;
  events: number;
  outbreaks: number;
  cases: number;
  deaths: number;
};

/** Ранжированные горизонтальные полосы: одна серия, один цвет, значение у конца полосы. */
export function RankedBars<T extends BarRow>({
  rows,
  metric = 'events',
  limit = 10,
  onSelect,
  unit = 'событий',
}: {
  rows: T[];
  metric?: Metric;
  limit?: number;
  /** Если задан, строки становятся кнопками */
  onSelect?: (row: T) => void;
  unit?: string;
}) {
  const shown = rows.slice(0, limit);
  if (!shown.length) return <Empty />;
  const max = Math.max(1, ...shown.map((r) => Number(r[metric]) || 0));

  return (
    <div className="kb-bars">
      {shown.map((r) => {
        const v = Number(r[metric]) || 0;
        const tip =
          `${r.label}: ${fmt(v)} ${unit}` +
          (metric === 'events'
            ? ` · очагов ${fmt(r.outbreaks)} · случаев ${fmt(r.cases)} · падёж ${fmt(r.deaths)}`
            : '');
        const cells = (
          <>
            <span className="kb-bars-label" title={r.label}>
              {r.label}
            </span>
            <span className="kb-bars-track">
              <span className="kb-bars-fill" style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <span className="kb-bars-value">{fmt(v)}</span>
          </>
        );
        return (
          <Tooltip key={r.key ?? r.label} label={tip} position="top-start" openDelay={120}>
            {onSelect ? (
              <button type="button" className="kb-bars-row clickable" onClick={() => onSelect(r)}>
                {cells}
              </button>
            ) : (
              <div className="kb-bars-row">{cells}</div>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}
