import { useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_FILTERS, filtersToSearch, parseFilters, toApiQuery, type Filters } from './model';
import { FiltersContext, type FiltersContextValue } from './useFilters';

/**
 * Один срез данных на все страницы: каждый график и таблица читают одни и те же параметры.
 * Источник истины — адресная строка: срез переживает перезагрузку, и ссылкой на него можно поделиться.
 */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();

  const filters = useMemo(() => parseFilters(new URLSearchParams(search)), [search]);
  const query = useMemo(() => toApiQuery(filters), [filters]);

  // replace: правка фильтра не должна плодить записи в истории браузера
  const set = useCallback(
    (patch: Partial<Filters>) =>
      setSearchParams((prev) => filtersToSearch({ ...parseFilters(prev), ...patch }), { replace: true }),
    [setSearchParams],
  );
  const reset = useCallback(
    () => setSearchParams(filtersToSearch(DEFAULT_FILTERS), { replace: true }),
    [setSearchParams],
  );

  const value = useMemo<FiltersContextValue>(() => ({ filters, query, set, reset }), [filters, query, set, reset]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}
