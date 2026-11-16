import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, queryKeys } from '../api';

/** Вход. Результат false — неверный логин или пароль; сбой сети или сервера — ошибка мутации. */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => login(username, password),
    // Кнопка остаётся в состоянии загрузки, пока не подтянется пользователь: экран сменится без мигания формы
    onSuccess: (ok) => (ok ? qc.invalidateQueries({ queryKey: queryKeys.me }) : undefined),
  });
}

/** Выход. Экран входа показывается сразу, данные прошлого пользователя убираются из кеша. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.setQueryData(queryKeys.me, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
    },
  });
}
