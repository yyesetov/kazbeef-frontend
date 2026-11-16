/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес бэкенда, если он на другом origin. Пусто — запросы идут на тот же origin (nginx или dev-прокси). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
