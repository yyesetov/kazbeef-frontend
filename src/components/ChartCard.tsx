import { useState, type ReactNode } from 'react';
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconChartBar, IconTable } from '@tabler/icons-react';
import { DataTable, type Column } from './DataTable';
import { ErrorState, Loading, type AsyncState } from './states';

/**
 * Карточка графика. У графика может быть табличный вид тех же данных.
 * Если передан query, карточка сама показывает загрузку и ошибку — содержимое рисуется только с данными.
 */
export function ChartCard<T = never>({
  title,
  subtitle,
  children,
  table,
  right,
  query,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  table?: { columns: Column<T>[]; rows: T[] };
  right?: ReactNode;
  query?: AsyncState;
}) {
  const [asTable, setAsTable] = useState(false);
  const toggleLabel = asTable ? 'Показать график' : 'Показать таблицу';

  let body: ReactNode;
  if (query?.isPending) body = <Loading />;
  else if (query?.isError) body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  else if (asTable && table) body = <DataTable {...table} />;
  else body = children;

  return (
    <div className="kb-card" style={{ height: '100%' }}>
      <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
        <div>
          <div className="kb-card-title">{title}</div>
          {subtitle && <div className="kb-card-sub">{subtitle}</div>}
        </div>
        <Group gap={6} wrap="nowrap">
          {right}
          {table && (
            <Tooltip label={toggleLabel}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setAsTable((v) => !v)}
                aria-label={toggleLabel}
                aria-pressed={asTable}
              >
                {asTable ? <IconChartBar size={16} /> : <IconTable size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      {body}
    </div>
  );
}
