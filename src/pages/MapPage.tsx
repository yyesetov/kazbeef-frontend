import { useState } from 'react';
import { useSlice, type MapPoint, type Summary } from '../api';
import { ChartCard } from '../components/ChartCard';
import { EventDrawer } from '../components/EventDrawer';
import { EventMap } from '../components/EventMap';
import { fmt } from '../lib/format';

export function MapPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const map = useSlice<MapPoint[]>('/api/map');
  const { data: summary } = useSlice<Summary>('/api/stats/summary');

  const points = map.data ?? [];
  const without = summary ? Number(summary.events) - points.length : 0;
  const subtitle =
    `${fmt(points.length)} событий на карте` +
    (without > 0 ? ` · ещё ${fmt(without)} без координат (см. раздел «События»)` : '');

  return (
    <>
      <ChartCard title="Карта очагов" subtitle={subtitle} query={map}>
        <EventMap points={points} height="calc(100dvh - 300px)" onSelect={setSelected} wheelZoom />
      </ChartCard>
      <EventDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  );
}
