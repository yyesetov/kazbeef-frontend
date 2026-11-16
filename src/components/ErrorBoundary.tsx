import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';

type Props = {
  children: ReactNode;
  /** При смене значения граница сбрасывается: переход на другую страницу снимает ошибку. */
  resetKey?: string;
};
type State = { error: Error | null; resetKey?: string };

/** Ловит исключения при отрисовке: вместо белого экрана — сообщение и способ продолжить работу. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка отрисовки', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert color="red" variant="light" title="Раздел не удалось показать">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">Произошла ошибка в интерфейсе. Данные на сервере не затронуты.</Text>
          <Text size="xs" c="dimmed">
            {this.state.error.message}
          </Text>
          <Button size="xs" variant="default" onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </Button>
        </Stack>
      </Alert>
    );
  }
}
