import type { ReactNode } from 'react';

/** Полоса показателей: одна поверхность с делениями. Внутрь кладутся StatTile. */
export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="kb-stats">{children}</div>;
}

export function StatTile({
  label,
  value,
  hint,
  marker,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Цвет метки перед значением */
  marker?: string;
}) {
  return (
    <div className="kb-stat">
      <div className="kb-stat-label">{label}</div>
      <div className="kb-stat-value">
        {marker && (
          <span className="kb-swatch round" style={{ background: marker, marginRight: 8, verticalAlign: 'middle' }} />
        )}
        {value}
      </div>
      {hint && <div className="kb-stat-hint">{hint}</div>}
    </div>
  );
}
