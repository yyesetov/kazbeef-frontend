import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = (names: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`);

/**
 * Тяжёлые библиотеки уходят в отдельные файлы: они меняются редко и кешируются независимо от кода приложения.
 * Чем выше priority, тем раньше группа забирает модуль: React общий для всех и должен оставаться в своём файле,
 * а не уезжать в файл первой библиотеки, которая его импортирует.
 */
const VENDOR_GROUPS = [
  { name: 'react', priority: 40, test: pkg('react|react-dom|react-router|react-router-dom|@remix-run|scheduler') },
  { name: 'charts', priority: 30, test: pkg('echarts|zrender|echarts-for-react|size-sensor') },
  {
    name: 'map',
    priority: 30,
    test: pkg('leaflet|leaflet\\.markercluster|react-leaflet|react-leaflet-cluster|@react-leaflet'),
  },
  {
    name: 'mantine',
    priority: 20,
    test: pkg('@mantine|@floating-ui|react-remove-scroll|react-textarea-autosize|dayjs'),
  },
  // Всё остальное из node_modules (мелкие общие зависимости): файлы страниц содержат только код приложения
  { name: 'vendor', priority: 10, test: /[\\/]node_modules[\\/]/ },
];

export default defineConfig(({ mode }) => {
  // Пустой префикс: читаем и переменные без VITE_, они нужны только конфигу и в сборку не попадают
  const env = loadEnv(mode, process.cwd(), '');
  // В разработке запросы к данным уходят на бэкенд; браузер видит один origin, как и за nginx в продакшене
  const backend = env.DEV_BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    base: env.VITE_BASE || '/',
    server: {
      port: 5173,
      proxy: { '/api': backend, '/admin': backend },
    },
    preview: {
      port: 4173,
      proxy: { '/api': backend, '/admin': backend },
    },
    build: {
      outDir: 'dist',
      // Самый крупный файл — библиотека графиков (~500 КБ). Она грузится только на страницах с графиками,
      // поэтому порог предупреждения поднят ровно под неё; первая загрузка в него не упирается.
      chunkSizeWarningLimit: 550,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: VENDOR_GROUPS,
            // Группа берёт только свои пакеты. Иначе общая мелкая зависимость (tslib) уезжает в файл графиков,
            // и он становится нужен на первой загрузке — ленивая подгрузка теряет смысл.
            includeDependenciesRecursively: false,
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
