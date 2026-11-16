// Всё, что зависит от окружения сборки, собрано здесь: остальной код не читает import.meta.env.

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Бэкенд на другом origin: cookie сессии нужно отправлять явно, а на бэкенде должен быть настроен CORS. */
export const CROSS_ORIGIN_API = API_ORIGIN !== '';

/** Полный адрес запроса к бэкенду по пути вида /api/... */
export const apiUrl = (path: string) => API_ORIGIN + path;

/** Базовый путь приложения для маршрутизатора: без завершающего слэша, пустая строка для корня. */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Адрес файла из public/ с учётом базового пути. */
export const assetUrl = (file: string) => import.meta.env.BASE_URL + file.replace(/^\/+/, '');
