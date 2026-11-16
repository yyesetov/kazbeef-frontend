import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  errorMessage,
  get,
  queryKeys,
  send,
  useReference,
  type AdminDisease,
  type DiseaseUpdate,
  type RefSpecies,
} from '../api';
import { ErrorState, Loading } from '../components/states';
import { fmt, parseJsonArray } from '../lib/format';
import { GROUP_LABEL } from '../theme';

/** Черновик правки. Идентификаторы видов — строками: так их хранит MultiSelect. */
type Draft = Omit<DiseaseUpdate, 'speciesIds'> & { id: number; speciesIds: string[] };

const toDraft = (d: AdminDisease): Draft => ({
  id: d.id,
  nameRu: d.nameRu ?? '',
  nameEn: d.nameEn ?? '',
  code: d.code ?? '',
  severity: d.severity,
  synonyms: parseJsonArray<string>(d.synonyms),
  speciesIds: parseJsonArray<number>(d.speciesIds).map(String),
});

const diseaseName = (d: AdminDisease) => d.nameRu ?? d.nameEn;

function DiseaseEditor({
  draft: initial,
  diseases,
  species,
  onClose,
}: {
  draft: Draft;
  diseases: AdminDisease[];
  species: RefSpecies[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [mergeInto, setMergeInto] = useState<string | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // Правка болезни пересчитывает значимость и риск всех событий: устаревает весь кеш, а не один список
  const onDone = (message: string) => {
    notifications.show({ message, color: 'green' });
    onClose();
    return qc.invalidateQueries();
  };
  const onError = (e: unknown) => notifications.show({ message: `Не сохранено: ${errorMessage(e)}`, color: 'red' });

  const save = useMutation({
    mutationFn: ({ id, ...body }: Draft) =>
      send(`/admin/diseases/${id}`, 'PUT', {
        ...body,
        speciesIds: body.speciesIds.map(Number),
      } satisfies DiseaseUpdate),
    onSuccess: () => onDone('Болезнь сохранена'),
    onError,
  });
  const merge = useMutation({
    mutationFn: (into: string) => send(`/admin/diseases/${draft.id}/merge?into=${encodeURIComponent(into)}`, 'POST'),
    onSuccess: () => onDone('Записи объединены'),
    onError,
  });

  const busy = save.isPending || merge.isPending;
  const nameMissing = !draft.nameEn.trim();
  const target = diseases.find((d) => String(d.id) === mergeInto);
  const speciesOptions = species.map((s) => ({
    value: String(s.id),
    label: `${s.name} · ${GROUP_LABEL[s.group] ?? s.group}`,
  }));
  const mergeOptions = diseases
    .filter((d) => d.id !== draft.id)
    .map((d) => ({ value: String(d.id), label: diseaseName(d) }));

  return (
    <Stack gap="sm">
      <TextInput
        label="Название на русском"
        value={draft.nameRu}
        onChange={(e) => patch({ nameRu: e.currentTarget.value })}
      />
      <TextInput
        label="Английское название"
        required
        value={draft.nameEn}
        onChange={(e) => patch({ nameEn: e.currentTarget.value })}
        error={nameMissing ? 'Обязательное поле' : undefined}
      />
      <Group grow align="flex-start">
        <TextInput label="Код" value={draft.code} onChange={(e) => patch({ code: e.currentTarget.value })} />
        <NumberInput
          label="Вес для КРС/МРС"
          description="1 — не опасна, 5 — особо опасная"
          min={1}
          max={5}
          allowDecimal={false}
          value={draft.severity}
          onChange={(v) => patch({ severity: Number(v) || 1 })}
        />
      </Group>
      <TagsInput
        label="Синонимы"
        description="Написания из источников; Enter добавляет"
        value={draft.synonyms}
        onChange={(v) => patch({ synonyms: v })}
      />
      <MultiSelect
        label="Восприимчивые виды"
        description="По ним определяется значимость события для КРС/МРС"
        data={speciesOptions}
        value={draft.speciesIds}
        onChange={(v) => patch({ speciesIds: v })}
        searchable
      />
      <Group justify="flex-end">
        <Button onClick={() => save.mutate(draft)} loading={save.isPending} disabled={nameMissing || merge.isPending}>
          Сохранить
        </Button>
      </Group>

      <Text size="sm" fw={600} mt="sm">
        Объединить с другой записью
      </Text>
      <Text size="xs" c="dimmed">
        События перейдут к выбранной болезни, названия этой записи станут её синонимами, запись будет удалена.
      </Text>
      <Group align="flex-end">
        <Select
          style={{ flex: 1 }}
          placeholder="Выберите болезнь"
          searchable
          value={mergeInto}
          onChange={(v) => {
            setMergeInto(v);
            setConfirmMerge(false);
          }}
          data={mergeOptions}
          aria-label="Болезнь, с которой объединить"
        />
        <Button variant="light" color="red" disabled={!mergeInto || busy} onClick={() => setConfirmMerge(true)}>
          Объединить
        </Button>
      </Group>
      {confirmMerge && mergeInto && (
        <Alert color="red" variant="light" title="Это действие нельзя отменить">
          <Stack gap="xs">
            <Text size="sm">
              Запись «{draft.nameRu || draft.nameEn}» будет удалена, её события перейдут к «
              {target ? diseaseName(target) : mergeInto}».
            </Text>
            <Group gap="xs">
              <Button size="xs" color="red" loading={merge.isPending} onClick={() => merge.mutate(mergeInto)}>
                Да, объединить
              </Button>
              <Button size="xs" variant="default" disabled={merge.isPending} onClick={() => setConfirmMerge(false)}>
                Отмена
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

export function ReferencePage() {
  const { data: ref } = useReference();
  const diseases = useQuery({
    queryKey: queryKeys.adminDiseases,
    queryFn: ({ signal }) => get<AdminDisease[]>('/admin/diseases', signal),
  });
  const [draft, setDraft] = useState<Draft | null>(null);

  if (diseases.isPending) return <Loading height={240} />;
  if (diseases.isError) return <ErrorState error={diseases.error} onRetry={() => void diseases.refetch()} />;

  const review = diseases.data.filter((d) => d.needsReview).length;

  return (
    <div className="kb-card">
      <div className="kb-card-title">Справочник болезней</div>
      <div className="kb-card-sub">
        {review > 0
          ? `Требуют проверки: ${review}. Эти записи сборщики завели автоматически, потому что не нашли болезнь в справочнике.`
          : 'Записей, требующих проверки, нет.'}
      </div>
      <Table.ScrollContainer minWidth={640} mt="sm">
        <Table highlightOnHover verticalSpacing={6} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Английское название</Table.Th>
              <Table.Th>Код</Table.Th>
              <Table.Th className="kb-num">Вес</Table.Th>
              <Table.Th className="kb-num">События</Table.Th>
              <Table.Th aria-label="Состояние" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {diseases.data.map((d) => (
              <Table.Tr
                key={d.id}
                className="kb-row"
                tabIndex={0}
                aria-label={`Изменить: ${diseaseName(d)}`}
                onClick={() => setDraft(toDraft(d))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDraft(toDraft(d));
                  }
                }}
              >
                <Table.Td>
                  {d.nameRu ?? (
                    <Text span c="dimmed">
                      не задано
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{d.nameEn}</Table.Td>
                <Table.Td>{d.code ?? '—'}</Table.Td>
                <Table.Td className="kb-num">{d.severity}</Table.Td>
                <Table.Td className="kb-num">{fmt(d.events)}</Table.Td>
                <Table.Td>
                  {d.needsReview && (
                    <Badge size="sm" color="yellow" variant="light">
                      Проверить
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={draft !== null} onClose={() => setDraft(null)} title="Болезнь" size="lg">
        {/* key: редактор хранит свой черновик и создаётся заново для каждой записи */}
        {draft && (
          <DiseaseEditor
            key={draft.id}
            draft={draft}
            diseases={diseases.data}
            species={ref?.species ?? []}
            onClose={() => setDraft(null)}
          />
        )}
      </Modal>
    </div>
  );
}
