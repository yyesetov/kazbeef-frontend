import { createContext, useContext } from 'react';
import type { Filters } from './model';

export type FiltersContextValue = {
  filters: Filters;
  /** Параметры запроса к API для текущего среза */
  query: string;
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
};

export const FiltersContext = createContext<FiltersContextValue | null>(null);

export function useFilters(): FiltersContextValue {
  const value = useContext(FiltersContext);
  if (!value) throw new Error('useFilters вызван вне FiltersProvider');
  return value;
}
