import { useState, type FormEvent } from 'react';
import { Alert, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { errorMessage } from '../api';
import { useLogin } from '../auth/useAuth';
import { assetUrl } from '../config';

export function LoginPage() {
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  // Неверный пароль и недоступный сервер — разные ситуации, и сообщения у них разные
  const problem = login.isError ? errorMessage(login.error) : login.data === false ? 'Неверный логин или пароль' : null;

  return (
    <main className="kb-login">
      <div className="kb-login-brand">
        <img className="kb-login-logo" src={assetUrl('logo-white.svg')} alt="KazBeef — мраморная говядина" />
        <p className="kb-login-purpose">Мониторинг болезней крупного и мелкого рогатого скота</p>
      </div>
      <div className="kb-login-form">
        <form onSubmit={submit}>
          <Stack gap="sm">
            <div>
              <h1 className="kb-login-title">Вход</h1>
              <Text size="sm" c="dimmed">
                Учётную запись выдаёт администратор системы.
              </Text>
            </div>
            {problem && (
              <Alert color="red" variant="light" p="xs" role="alert">
                {problem}
              </Alert>
            )}
            <TextInput
              label="Логин"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              autoComplete="username"
              required
              autoFocus
            />
            <PasswordInput
              label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" loading={login.isPending} mt="xs">
              Войти
            </Button>
          </Stack>
        </form>
      </div>
    </main>
  );
}
