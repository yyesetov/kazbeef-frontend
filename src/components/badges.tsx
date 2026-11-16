import { Badge } from '@mantine/core';
import type { EventStatus, TrustLevel } from '../api';
import { STATUS_COLOR, STATUS_LABEL, TRUST_COLOR, TRUST_LABEL, riskLevel } from '../theme';

// Значение, которого нет в словаре (бэкенд добавил новое), показывается как есть, серым

export const StatusBadge = ({ status }: { status: EventStatus }) => (
  <Badge size="sm" variant="light" color={STATUS_COLOR[status] ?? 'gray'}>
    {STATUS_LABEL[status] ?? status}
  </Badge>
);

export const TrustBadge = ({ level }: { level: TrustLevel }) => (
  <Badge size="sm" variant="outline" color={TRUST_COLOR[level] ?? 'gray'}>
    {TRUST_LABEL[level] ?? level}
  </Badge>
);

/** Уровень риска: цветная метка всегда идёт вместе с подписью и числом. */
export function RiskBadge({ score }: { score: number | null | undefined }) {
  const level = riskLevel(score);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span className="kb-swatch round" style={{ background: level.color }} />
      {score == null ? '—' : `${score} · ${level.label}`}
    </span>
  );
}
