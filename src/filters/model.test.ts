import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  filtersToSearch,
  fromIsoDate,
  parseFilters,
  toApiQuery,
  toIsoDate,
  type Filters,
} from './model';

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch });
const TODAY = new Date(2026, 10, 16); // 16.11.2026 по местному времени

describe('parseFilters', () => {
  it('пустая строка даёт значения по умолчанию', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
  });

  it('читает списки, период, поиск и признак «все виды»', () => {
    const f = parseFilters(new URLSearchParams('countries=KAZ&countries=RUS&diseases=7&period=90&all=1&q=ящур'));
    expect(f).toEqual(
      filters({ countries: ['KAZ', 'RUS'], diseases: ['7'], period: '90', ruminantOnly: false, q: 'ящур' }),
    );
  });

  it('испорченные значения заменяет значениями по умолчанию', () => {
    const f = parseFilters(new URLSearchParams('period=вчера&from=2026-13&to=not-a-date'));
    expect(f.period).toBe('365');
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
  });
});

describe('filtersToSearch', () => {
  it('значения по умолчанию не попадают в адрес', () => {
    expect(filtersToSearch(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('границы периода пишутся только для произвольного периода', () => {
    const range = { from: '2026-01-01', to: '2026-02-01' };
    expect(filtersToSearch(filters({ period: '30', ...range })).toString()).toBe('period=30');
    expect(filtersToSearch(filters({ period: 'custom', ...range })).toString()).toBe(
      'period=custom&from=2026-01-01&to=2026-02-01',
    );
  });

  it('обратим: разбор собранной строки возвращает те же фильтры', () => {
    const original = filters({
      countries: ['KAZ'],
      groups: ['CATTLE', 'OTHER'],
      sources: ['WAHIS'],
      status: ['new'],
      period: 'custom',
      from: '2026-03-01',
      to: '2026-03-31',
      ruminantOnly: false,
      q: 'сибирская язва',
    });
    expect(parseFilters(filtersToSearch(original))).toEqual(original);
  });
});

describe('toApiQuery', () => {
  it('относительный период превращается в дату начала', () => {
    expect(toApiQuery(filters({ period: '30' }), TODAY)).toBe('from=2026-10-17&ruminantOnly=true');
  });

  it('«всё время» не ограничивает даты', () => {
    expect(toApiQuery(filters({ period: 'all' }), TODAY)).toBe('ruminantOnly=true');
  });

  it('произвольный период передаёт обе границы, а без них — ничего', () => {
    expect(toApiQuery(filters({ period: 'custom', from: '2026-01-01', to: '2026-01-31' }), TODAY)).toBe(
      'from=2026-01-01&to=2026-01-31&ruminantOnly=true',
    );
    expect(toApiQuery(filters({ period: 'custom' }), TODAY)).toBe('ruminantOnly=true');
  });

  it('списки повторяют параметр, поиск обрезается по краям', () => {
    const query = new URLSearchParams(
      toApiQuery(filters({ period: 'all', countries: ['KAZ', 'RUS'], q: '  ящур ' }), TODAY),
    );
    expect(query.getAll('countries')).toEqual(['KAZ', 'RUS']);
    expect(query.get('q')).toBe('ящур');
  });

  it('пустой поиск не отправляется', () => {
    expect(toApiQuery(filters({ period: 'all', q: '   ' }), TODAY)).toBe('ruminantOnly=true');
  });
});

describe('даты календаря', () => {
  it('день не сдвигается при переводе в строку и обратно', () => {
    expect(toIsoDate(fromIsoDate('2026-03-01'))).toBe('2026-03-01');
    expect(toIsoDate(null)).toBeNull();
    expect(fromIsoDate(null)).toBeNull();
  });
});
