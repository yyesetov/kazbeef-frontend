import type { ReactNode } from 'react';
import { ScrollArea, Table } from '@mantine/core';
import { fmt } from '../lib/format';
import { Empty } from './states';

export type Column<T> = {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  /** Своё содержимое ячейки; по умолчанию показывается значение поля */
  render?: (row: T) => ReactNode;
};

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return fmt(value);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  if (!rows.length) return <Empty />;
  return (
    <ScrollArea.Autosize mah={340}>
      <Table striped highlightOnHover verticalSpacing={4} fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.key} className={c.numeric ? 'kb-num' : undefined}>
                {c.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Table.Tr key={i}>
              {columns.map((c) => (
                <Table.Td key={c.key} className={c.numeric ? 'kb-num' : undefined}>
                  {c.render ? c.render(r) : cellText(r[c.key])}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  );
}
