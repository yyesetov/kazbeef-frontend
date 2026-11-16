import { Button, Menu } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { apiUrl } from '../config';
import { useFilters } from '../filters/useFilters';

const FORMATS = [
  { file: 'events.xlsx', label: 'События, Excel (.xlsx)' },
  { file: 'events.csv', label: 'События, CSV' },
  { file: 'weekly.pdf', label: 'Недельная сводка (PDF)' },
];

/** Выгрузка текущего среза. Файлы отдаёт сервер, поэтому это обычные ссылки. */
export function ExportMenu() {
  const { query } = useFilters();
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
          Экспорт
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {FORMATS.map((f) => (
          <Menu.Item key={f.file} component="a" href={apiUrl(`/api/export/${f.file}?${query}`)}>
            {f.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
