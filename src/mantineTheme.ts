import {
  Badge,
  Drawer,
  Menu,
  Modal,
  Popover,
  Tooltip,
  createTheme,
  type MantineColorsTuple,
  type MantineTransition,
} from '@mantine/core';

/**
 * Фирменный бордовый KazBeef (#8c2628 — седьмая ступень) и его оттенки.
 * Бордовый — цвет оболочки: меню, кнопки, фокус. Данные на графиках остаются синими, а красно-жёлто-зелёная
 * шкала занята уровнем риска (см. theme.ts) — три смысла не должны сливаться.
 */
const brand: MantineColorsTuple = [
  '#fbf0f0',
  '#f3dcdc',
  '#e6b5b6',
  '#d98c8e',
  '#ce6a6d',
  '#c25356',
  '#aa3a3d',
  '#8c2628',
  '#741f21',
  '#5c181a',
];

/** Текст и таблицы: гарнитура спроектирована под кириллицу и плотнее Montserrat в строке. */
const TEXT_FONT = '"Golos Text Variable", system-ui, -apple-system, "Segoe UI", sans-serif';
/** Заголовки, меню и крупные числа: фирменная гарнитура KazBeef. В CSS та же пара задана как --kb-font-display. */
const DISPLAY_FONT = '"Montserrat Variable", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Появление — без перелёта; те же кривые, что --kb-ease-enter и --kb-ease в styles.css. */
const EASE_ENTER = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** Выпадающее меню опускается на 6px и проявляется. */
const DROP: MantineTransition = {
  in: { opacity: 1, transform: 'translateY(0)' },
  out: { opacity: 0, transform: 'translateY(-6px)' },
  transitionProperty: 'opacity, transform',
};

export const mantineTheme = createTheme({
  // Mantine сам отключает свои переходы, если в системе включено «уменьшить движение»
  respectReducedMotion: true,
  colors: { brand },
  primaryColor: 'brand',
  // В тёмной схеме седьмая ступень слишком глухая: берём светлее, чтобы кнопки и фокус читались
  primaryShade: { light: 7, dark: 5 },
  fontFamily: TEXT_FONT,
  headings: { fontFamily: DISPLAY_FONT, fontWeight: '700' },
  // Скругление по роли: поля и кнопки — 6, карточки — 10 (в styles.css), метки — «таблетка»
  radius: { xs: '3px', sm: '6px', md: '8px', lg: '10px', xl: '16px' },
  defaultRadius: 'sm',
  components: {
    // Метки статуса — обычным регистром: заглавные буквы в мелком кегле хуже читаются и кричат
    Badge: Badge.extend({
      defaultProps: { radius: 'xl' },
      styles: { label: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 } },
    }),
    // Карточка партии выезжает и «садится», а не появляется рывком
    Drawer: Drawer.extend({ defaultProps: { transitionProps: { duration: 280, timingFunction: EASE_ENTER } } }),
    Modal: Modal.extend({
      defaultProps: { transitionProps: { transition: 'pop', duration: 220, timingFunction: EASE_ENTER } },
    }),
    Menu: Menu.extend({ defaultProps: { transitionProps: { transition: DROP, duration: 200, timingFunction: EASE } } }),
    Popover: Popover.extend({
      defaultProps: { transitionProps: { transition: DROP, duration: 200, timingFunction: EASE } },
    }),
    Tooltip: Tooltip.extend({ defaultProps: { transitionProps: { transition: 'fade', duration: 150 } } }),
  },
});
