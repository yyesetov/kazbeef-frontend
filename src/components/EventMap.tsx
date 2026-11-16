import { useMemo } from 'react';
import { Anchor, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { get, queryKeys, type MapPoint } from '../api';
import { fmt, fmtDate } from '../lib/format';
import { NO_RISK, RISK_LEVELS, riskLevel, useChartTheme } from '../theme';
import { MarkerClusterGroup } from './MarkerClusterGroup';

const clusterIcon = (cluster: { getChildCount(): number }) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 30 : n < 100 ? 36 : 42;
  return L.divIcon({ html: String(n), className: 'kb-cluster', iconSize: L.point(size, size) });
};

// Контуры не меняются: грузим один раз за сеанс
const geoQuery = (name: string, path: string) => ({
  queryKey: queryKeys.geo(name),
  queryFn: ({ signal }: { signal: AbortSignal }) => get<GeoJsonObject>(path, signal),
  staleTime: Infinity,
});

/** Карта очагов. Цвет точки — уровень риска для Казахстана, размер — число очагов. */
export function EventMap({
  points,
  height = 420,
  onSelect,
  wheelZoom = false,
}: {
  points: MapPoint[];
  height?: number | string;
  onSelect?: (id: number) => void;
  /** Масштаб колесом мыши; на странице с прокруткой выключен, чтобы карта не перехватывала прокрутку */
  wheelZoom?: boolean;
}) {
  const t = useChartTheme();
  const accent = t.series[0];
  const { data: border } = useQuery(geoQuery('kazakhstan', '/api/geo/kazakhstan'));
  // Зона — необязательный слой: без неё карта остаётся рабочей
  const { data: zone } = useQuery({ ...geoQuery('border-zone', '/api/geo/border-zone'), retry: false });

  // Точек бывают тысячи: пересоздаём их только при смене данных или темы
  const markers = useMemo(
    () =>
      points.map((p) => {
        const level = riskLevel(p.riskScore);
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={6 + Math.min(8, Math.sqrt(Number(p.outbreaks) || 0))}
            pathOptions={{
              color: t.surface,
              weight: 2,
              fillColor: level.color,
              fillOpacity: p.status === 'closed' ? 0.55 : 0.95,
            }}
          >
            <Popup>
              <Text fw={600} size="sm">
                {p.disease}
              </Text>
              <Text size="xs">
                {p.country}
                {p.region ? ` · ${p.region}` : ''}
              </Text>
              <Text size="xs" c="dimmed">
                {fmtDate(p.eventDate)} · очагов {fmt(p.outbreaks)} · случаев {fmt(p.cases)} · падёж {fmt(p.deaths)}
              </Text>
              <Text size="xs">
                Риск: {level.label}
                {p.riskScore != null ? ` (${p.riskScore})` : ''}
                {p.distanceKm != null
                  ? ` · до границы РК ${p.distanceKm > 0 ? `${fmt(p.distanceKm)} км` : '0 км (внутри страны)'}`
                  : ''}
              </Text>
              {onSelect && (
                <Anchor size="xs" component="button" type="button" onClick={() => onSelect(p.id)}>
                  Открыть карточку
                </Anchor>
              )}
            </Popup>
          </CircleMarker>
        );
      }),
    [points, t.surface, onSelect],
  );

  return (
    <div className={t.dark ? 'kb-map kb-map-dark' : 'kb-map'}>
      <MapContainer
        center={[48, 68]}
        zoom={4}
        minZoom={2}
        style={{ height, width: '100%' }}
        preferCanvas
        scrollWheelZoom={wheelZoom}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={12}
        />
        {zone && (
          <GeoJSON
            data={zone}
            interactive={false}
            style={{ color: accent, weight: 1, opacity: 0.5, fillColor: accent, fillOpacity: 0.05 }}
          />
        )}
        {border && <GeoJSON data={border} interactive={false} style={{ color: accent, weight: 2, fillOpacity: 0 }} />}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={34}
          showCoverageOnHover={false}
          iconCreateFunction={clusterIcon}
        >
          {markers}
        </MarkerClusterGroup>
      </MapContainer>
      <div className="kb-legend" style={{ marginTop: 8 }}>
        <span>Риск для Казахстана:</span>
        {[...RISK_LEVELS, NO_RISK].map((l) => (
          <span key={l.label} className="kb-legend-item">
            <span className="kb-swatch round" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="kb-legend-item">
          <span className="kb-swatch" style={{ background: 'transparent', border: `2px solid ${accent}` }} />
          Граница РК и зона 300 км
        </span>
        <span>· Размер точки — число очагов · Бледные точки — закрытые события</span>
      </div>
    </div>
  );
}
