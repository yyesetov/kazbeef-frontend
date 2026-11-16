import { Alert, Button, Center, Group, Loader, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { errorMessage } from '../api';

/** Минимум, который нужен от запроса, чтобы показать его состояние. Подходит любой результат useQuery. */
export type AsyncState = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

export const Empty = ({ text = 'Нет данных по выбранным фильтрам' }: { text?: string }) => (
  <Text c="dimmed" size="sm" ta="center" py="xl">
    {text}
  </Text>
);

export const Loading = ({ height = 120 }: { height?: number | string }) => (
  <Center mih={height} role="status" aria-label="Загрузка">
    <Loader size="sm" />
  </Center>
);

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert color="red" variant="light" title="Не удалось загрузить данные" icon={<IconAlertTriangle size={18} />}>
      <Group justify="space-between" gap="sm">
        <Text size="sm">{errorMessage(error)}</Text>
        {onRetry && (
          <Button size="xs" variant="default" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </Group>
    </Alert>
  );
}
