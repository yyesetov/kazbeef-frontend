import {
  IconBooks,
  IconChartHistogram,
  IconDatabase,
  IconDeviceCctv,
  IconLayoutDashboard,
  IconList,
  IconMeat,
  IconSatellite,
  type Icon,
} from '@tabler/icons-react';

export type NavItem = {
  path: string;
  /** Подпись в меню */
  label: string;
  /** Заголовок страницы, если он отличается от подписи */
  title?: string;
  icon: Icon;
  /** Срез фильтров на странице не используется: панель фильтров скрыта */
  noFilters?: boolean;
};

export const NAV: NavItem[] = [
  { path: '/', label: 'Обзор', icon: IconLayoutDashboard },
  { path: '/events', label: 'События', icon: IconList },
  { path: '/analytics', label: 'Аналитика', icon: IconChartHistogram },
  { path: '/production', label: 'Производство', title: 'Путь продукции', icon: IconMeat, noFilters: true },
  { path: '/video', label: 'Видеомониторинг', icon: IconDeviceCctv, noFilters: true },
];

export const ADMIN_NAV: NavItem[] = [
  { path: '/sources', label: 'Источники', title: 'Источники данных', icon: IconSatellite, noFilters: true },
  { path: '/reference', label: 'Справочники', icon: IconDatabase, noFilters: true },
  { path: '/knowledge', label: 'База знаний', icon: IconBooks, noFilters: true },
];

const ALL = [...NAV, ...ADMIN_NAV];

export const findNavItem = (pathname: string) => ALL.find((n) => n.path === pathname);
