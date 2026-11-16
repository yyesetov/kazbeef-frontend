import { useMemo } from 'react';
import { ScrollArea } from '@mantine/core';
import type { MatrixRow, Metric } from '../api';
import { fmt } from '../lib/format';
import { heatColor } from '../theme';
import { Empty } from './states';

const cellKey = (disease: string, country: string) => `${disease}|${country}`;

/** Тепловая таблица «болезнь × страна»: значение подписано в каждой ячейке. */
export function HeatTable({ rows, metric = 'events' }: { rows: MatrixRow[]; metric?: Metric }) {
  const { diseases, countries, cells, max } = useMemo(() => {
    const byDisease = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const cellMap = new Map<string, number>();
    let mx = 0;
    for (const r of rows) {
      const v = Number(r[metric]) || 0;
      byDisease.set(r.disease, (byDisease.get(r.disease) ?? 0) + v);
      byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + v);
      cellMap.set(cellKey(r.disease, r.country), v);
      mx = Math.max(mx, v);
    }
    // Строки и столбцы — по убыванию суммы: самое значимое в левом верхнем углу
    const byTotal = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    return { diseases: byTotal(byDisease), countries: byTotal(byCountry), cells: cellMap, max: mx };
  }, [rows, metric]);

  if (!rows.length) return <Empty />;
  return (
    <ScrollArea>
      <table className="kb-heat">
        <thead>
          <tr>
            <td />
            {countries.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diseases.map((d) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              {countries.map((c) => {
                const v = cells.get(cellKey(d, c)) ?? 0;
                return v ? (
                  <td key={c} style={heatColor(v, max)} title={`${d} · ${c}: ${fmt(v)}`}>
                    {fmt(v)}
                  </td>
                ) : (
                  <td key={c} className="empty">
                    ·
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
