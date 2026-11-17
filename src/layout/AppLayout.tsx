import { Suspense, lazy, useState } from 'react';
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Collapse,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconChevronRight, IconLogout, IconMoon, IconSun } from '@tabler/icons-react';
import { Navigate, NavLink as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import { errorMessage, type Me } from '../api';
import { useLogout } from '../auth/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ExportMenu } from '../components/ExportMenu';
import { Loading } from '../components/states';
import { assetUrl } from '../config';
import { FilterBar } from '../filters/FilterBar';
import { ADMIN_NAV, NAV, findNavItem, type NavItem } from './navigation';

// Страницы грузятся по требованию: карта и графики не попадают в первую загрузку и на экран входа
const Dashboard = lazy(() => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const EventsPage = lazy(() => import('../pages/EventsPage').then((m) => ({ default: m.EventsPage })));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const TraceabilityPage = lazy(() => import('../pages/TraceabilityPage').then((m) => ({ default: m.TraceabilityPage })));
const VideoMonitoringPage = lazy(() =>
  import('../pages/VideoMonitoringPage').then((m) => ({ default: m.VideoMonitoringPage })),
);
const SourcesPage = lazy(() => import('../pages/SourcesPage').then((m) => ({ default: m.SourcesPage })));
const ReferencePage = lazy(() => import('../pages/ReferencePage').then((m) => ({ default: m.ReferencePage })));
const KnowledgeBasePage = lazy(() =>
  import('../pages/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage })),
);

const HEADER_HEIGHT = 52;
const NAVBAR_WIDTH = 232;

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme('light') === 'dark';
  const label = dark ? 'Светлая тема' : 'Тёмная тема';
  return (
    <Tooltip label={label}>
      <ActionIcon className="kb-rail-action" onClick={() => setColorScheme(dark ? 'light' : 'dark')} aria-label={label}>
        {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

function LogoutButton() {
  const logout = useLogout();
  return (
    <Tooltip label="Выйти">
      <ActionIcon
        className="kb-rail-action"
        aria-label="Выйти"
        loading={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onError: (e) => notifications.show({ message: `Не удалось выйти: ${errorMessage(e)}`, color: 'red' }),
          })
        }
      >
        <IconLogout size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

const LOGO_ALT = 'KazBeef — мраморная говядина';

/** Компактная подпись для узкой шапки: полный логотип с надписью в 52 px не читается. */
function TopbarBrand() {
  return (
    <Group gap={10} wrap="nowrap">
      <img className="kb-topbar-mark" src={assetUrl('mark.svg')} alt={LOGO_ALT} />
      <span className="kb-topbar-name">Мониторинг болезней</span>
    </Group>
  );
}

export function AppLayout({ me }: { me: Me }) {
  const location = useLocation();
  const [menuOpened, menu] = useDisclosure(false);
  const current = findNavItem(location.pathname);
  // Раздел «Управление» свёрнут по умолчанию; открыт сразу, только если открыта одна из его страниц
  const [adminOpened, setAdminOpened] = useState(() => ADMIN_NAV.some((n) => n.path === location.pathname));

  // Срез фильтров живёт в адресной строке: ссылки меню несут его с собой, иначе переход сбрасывал бы фильтры
  const link = (n: NavItem) => (
    <NavLink
      key={n.path}
      component={RouterLink}
      to={{ pathname: n.path, search: location.search }}
      end
      label={n.label}
      leftSection={<n.icon size={18} stroke={1.6} />}
      onClick={menu.close}
      className="kb-navlink"
    />
  );

  return (
    <AppShell
      // На узком экране меню прячется за кнопку в шапке; на широком шапки нет, меню всегда слева
      header={{ height: { base: HEADER_HEIGHT, sm: 0 } }}
      navbar={{ width: NAVBAR_WIDTH, breakpoint: 'sm', collapsed: { mobile: !menuOpened } }}
      padding="md"
    >
      <AppShell.Header hiddenFrom="sm" px="md" className="kb-topbar">
        <Group h="100%" gap="sm">
          <Burger
            opened={menuOpened}
            onClick={menu.toggle}
            size="sm"
            color="#fff"
            aria-label={menuOpened ? 'Закрыть меню' : 'Открыть меню'}
          />
          <TopbarBrand />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" className="kb-rail">
        <Box px={10} pt={10} pb={22} visibleFrom="sm">
          <img className="kb-rail-logo" src={assetUrl('logo-white.svg')} alt={LOGO_ALT} />
        </Box>
        <nav aria-label="Разделы">
          <Stack gap={2}>{NAV.map(link)}</Stack>
          {me.admin && (
            <>
              <button
                type="button"
                className="kb-rail-section"
                aria-expanded={adminOpened}
                aria-controls="kb-admin-nav"
                onClick={() => setAdminOpened((o) => !o)}
              >
                <IconChevronRight size={14} className="kb-rail-chevron" data-open={adminOpened || undefined} />
                Управление
              </button>
              <Collapse in={adminOpened} id="kb-admin-nav">
                <Stack gap={2}>{ADMIN_NAV.map(link)}</Stack>
              </Collapse>
            </>
          )}
        </nav>
        <Group mt="auto" justify="space-between" px={6} wrap="nowrap">
          <Text className="kb-rail-user" truncate>
            {me.username}
          </Text>
          <Group gap={6} wrap="nowrap">
            <ThemeToggle />
            <LogoutButton />
          </Group>
        </Group>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Снизу место под плавающую кнопку чата: она не закрывает пагинацию и последние строки */}
        <Stack gap="md" className="kb-fab-space">
          <Group justify="space-between">
            <h1 className="kb-page-title">{current?.title ?? current?.label ?? 'KazBeef'}</h1>
            {location.pathname === '/' && <ExportMenu />}
          </Group>
          {!current?.noFilters && <FilterBar />}
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<Loading height={240} />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/production" element={<TraceabilityPage />} />
                <Route path="/video" element={<VideoMonitoringPage />} />
                {me.admin && <Route path="/sources" element={<SourcesPage />} />}
                {me.admin && <Route path="/reference" element={<ReferencePage />} />}
                {me.admin && <Route path="/knowledge" element={<KnowledgeBasePage />} />}
                <Route path="*" element={<Navigate to={{ pathname: '/', search: location.search }} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
