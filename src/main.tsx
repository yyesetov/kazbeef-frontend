import { StrictMode } from 'react';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import 'dayjs/locale/ru';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Шрифты лежат в сборке: интерфейс не ходит за ними на сторонние серверы и работает в закрытой сети
import '@fontsource-variable/golos-text';
import '@fontsource-variable/montserrat';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import { queryClient } from './api/queryClient';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ROUTER_BASENAME } from './config';
import { mantineTheme } from './mantineTheme';

const root = document.getElementById('root');
if (!root) throw new Error('В index.html нет элемента #root');

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: 'ru' }}>
        <Notifications position="top-right" />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            {/* Флаги будущей версии: поведение уже как в React Router 7, переход на него не потребует правок */}
            <BrowserRouter basename={ROUTER_BASENAME} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
