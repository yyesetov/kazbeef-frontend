import { useState } from 'react';
import { ActionIcon, Group, MultiSelect, SegmentedControl, Switch, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconFilterOff, IconSearch } from '@tabler/icons-react';
import { useReference } from '../api';
import { GROUP_LABEL, STATUS_LABEL, toOptions } from '../theme';
import { fromIsoDate, toIsoDate, type Period } from './model';
import { useFilters } from './useFilters';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: 'all', label: 'Всё время' },
  { value: 'custom', label: 'Период' },
];
const GROUP_OPTIONS = toOptions(GROUP_LABEL);
const STATUS_OPTIONS = toOptions(STATUS_LABEL);

export function FilterBar() {
  const { filters, set, reset } = useFilters();
  const { data: ref } = useReference();
  // Поле поиска хранит текст само и отдаёт его в фильтры с задержкой; ключ пересоздаёт поле при сбросе
  const [searchKey, setSearchKey] = useState(0);
  const setQuery = useDebouncedCallback((q: string) => set({ q }), 350);

  const countries = (ref?.countries ?? []).map((c) => ({ value: c.iso3, label: c.name }));
  // Болезни без событий скрыты, но уже выбранная остаётся в списке, иначе её нельзя снять
  const diseases = (ref?.diseases ?? [])
    .filter((d) => d.events > 0 || filters.diseases.includes(String(d.id)))
    .map((d) => ({ value: String(d.id), label: d.name }));
  const sources = (ref?.sources ?? []).map((s) => ({ value: s.code, label: s.code }));

  return (
    <div className="kb-card kb-filters" style={{ padding: 12 }}>
      <Group gap="sm" align="flex-end">
        <SegmentedControl
          size="xs"
          value={filters.period}
          onChange={(v) => set({ period: v as Period })}
          data={PERIOD_OPTIONS}
          aria-label="Период"
        />
        {filters.period === 'custom' && (
          <DatePickerInput
            type="range"
            size="xs"
            w={220}
            placeholder="Выберите даты"
            valueFormat="DD.MM.YYYY"
            value={[fromIsoDate(filters.from), fromIsoDate(filters.to)]}
            onChange={([from, to]) => set({ from: toIsoDate(from), to: toIsoDate(to) })}
            clearable
            aria-label="Даты периода"
          />
        )}
        <MultiSelect
          size="xs"
          w={190}
          placeholder={filters.countries.length ? '' : 'Страна'}
          data={countries}
          value={filters.countries}
          onChange={(v) => set({ countries: v })}
          clearable
          searchable
          aria-label="Страна"
        />
        <MultiSelect
          size="xs"
          w={230}
          placeholder={filters.diseases.length ? '' : 'Болезнь'}
          data={diseases}
          value={filters.diseases}
          onChange={(v) => set({ diseases: v })}
          clearable
          searchable
          aria-label="Болезнь"
        />
        <MultiSelect
          size="xs"
          w={150}
          placeholder={filters.groups.length ? '' : 'Поражённый вид'}
          data={GROUP_OPTIONS}
          value={filters.groups}
          onChange={(v) => set({ groups: v })}
          clearable
          aria-label="Поражённый вид"
        />
        <MultiSelect
          size="xs"
          w={150}
          placeholder={filters.status.length ? '' : 'Статус'}
          data={STATUS_OPTIONS}
          value={filters.status}
          onChange={(v) => set({ status: v })}
          clearable
          aria-label="Статус"
        />
        <MultiSelect
          size="xs"
          w={140}
          placeholder={filters.sources.length ? '' : 'Источник'}
          data={sources}
          value={filters.sources}
          onChange={(v) => set({ sources: v })}
          clearable
          aria-label="Источник"
        />
        <TextInput
          key={searchKey}
          size="xs"
          w={180}
          placeholder="Поиск"
          leftSection={<IconSearch size={14} />}
          defaultValue={filters.q}
          onChange={(e) => setQuery(e.currentTarget.value)}
          aria-label="Поиск"
        />
        <Tooltip
          multiline
          w={280}
          label="Включено: события, где поражены КРС, овцы или козы, либо болезнь опасна для них. Выключено: все события."
        >
          <div>
            <Switch
              size="sm"
              label="Только КРС/МРС"
              checked={filters.ruminantOnly}
              onChange={(e) => set({ ruminantOnly: e.currentTarget.checked })}
              mb={4}
            />
          </div>
        </Tooltip>
        <Tooltip label="Сбросить фильтры">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => {
              reset();
              setSearchKey((k) => k + 1);
            }}
            aria-label="Сбросить фильтры"
            mb={2}
          >
            <IconFilterOff size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </div>
  );
}
