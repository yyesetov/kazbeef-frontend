import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import '@mantine/dropzone/styles.css';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDots,
  IconDownload,
  IconEye,
  IconFileText,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  del,
  errorMessage,
  get,
  getText,
  queryKeys,
  send,
  sendText,
  upload,
  type KbDocument,
  type KbDocumentUpdate,
  type KbFormats,
  type KbQuestion,
  type KbUploadResult,
} from '../api';
import { Markdown } from '../components/markdown/Markdown';
import { Empty, ErrorState, Loading } from '../components/states';
import { apiUrl } from '../config';
import { fmt, fmtDateTime, fmtSize } from '../lib/format';

/** Пока документы обрабатываются, список перезапрашивается так часто; потом — не перезапрашивается. */
const POLL_PROCESSING_MS = 2_000;
const QUESTIONS_LIMIT = 20;

const docPath = (id: number) => `/admin/kb/documents/${id}`;

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
};

/** Документы устарели: после любого изменения список перечитывается (и снова опрашивается, если пошла обработка). */
function useInvalidateDocuments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.kbDocuments });
}

// ---------- загрузка ----------

function UploadZone() {
  const formats = useQuery({
    queryKey: queryKeys.kbFormats,
    queryFn: ({ signal }) => get<KbFormats>('/admin/kb/formats', signal),
    staleTime: 10 * 60_000,
  });
  const invalidate = useInvalidateDocuments();

  const uploadFiles = useMutation({
    mutationFn: (files: File[]) => upload<KbUploadResult[]>('/admin/kb/documents', files),
    onSuccess: (results) => {
      for (const r of results) {
        if (r.status === 'rejected') {
          notifications.show({ title: r.name, message: r.error ?? 'Файл отклонён', color: 'red', autoClose: 10_000 });
        } else {
          notifications.show({ title: r.name, message: 'Принят, идёт обработка', color: 'green' });
        }
      }
    },
    onError: (e) =>
      notifications.show({ message: `Не загружено: ${errorMessage(e)}`, color: 'red', autoClose: 10_000 }),
    onSettled: () => invalidate(),
  });

  const extensions = formats.data?.extensions ?? [];
  const maxMb = formats.data?.maxFileSizeMb;
  const maxBytes = maxMb ? maxMb * 1024 * 1024 : undefined;

  // Проверяем до отправки: незачем гнать на сервер 60 МБ, чтобы узнать, что файл не подходит
  const onDrop = (files: File[]) => {
    const accepted: File[] = [];
    for (const f of files) {
      const ext = extensionOf(f.name);
      if (extensions.length && !extensions.includes(ext)) {
        notifications.show({
          title: f.name,
          message: ext ? `Формат «.${ext}» не поддерживается` : 'У файла нет расширения',
          color: 'red',
        });
      } else if (maxBytes && f.size > maxBytes) {
        notifications.show({ title: f.name, message: `Файл больше ${maxMb} МБ`, color: 'red' });
      } else {
        accepted.push(f);
      }
    }
    if (accepted.length) uploadFiles.mutate(accepted);
  };

  const onReject = (rejections: FileRejection[]) => {
    for (const r of rejections) {
      notifications.show({ title: r.file.name, message: r.errors[0]?.message ?? 'Файл отклонён', color: 'red' });
    }
  };

  return (
    <div className="kb-card">
      <Dropzone
        className="kb-dropzone"
        onDrop={onDrop}
        onReject={onReject}
        multiple
        loading={uploadFiles.isPending}
        disabled={formats.isPending}
        aria-label="Загрузить документы"
      >
        <Group justify="center" gap="md" wrap="nowrap" style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={36} stroke={1.5} color="var(--kb-brand)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={36} stroke={1.5} color="var(--mantine-color-error)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFileText size={36} stroke={1.5} color="var(--kb-muted)" />
          </Dropzone.Idle>
          <div>
            <Text fw={600}>Перетащите документы сюда или нажмите, чтобы выбрать</Text>
            <Text size="sm" c="dimmed">
              {formats.data
                ? `Форматы: ${extensions.map((e) => `.${e}`).join(', ')}. До ${maxMb} МБ каждый.`
                : formats.isError
                  ? `Не удалось узнать поддерживаемые форматы: ${errorMessage(formats.error)}`
                  : 'Загружаю список форматов…'}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Документ превращается в текст Markdown: заголовки, списки и таблицы сохраняются, изображения не
              переносятся.
            </Text>
          </div>
        </Group>
      </Dropzone>
    </div>
  );
}

// ---------- просмотр и правка ----------

function useMarkdown(id: number | null) {
  return useQuery({
    queryKey: queryKeys.kbMarkdown(id ?? 0),
    queryFn: ({ signal }) => getText(`${docPath(id ?? 0)}/markdown`, signal),
    enabled: id !== null,
    staleTime: 0,
  });
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <Group gap={4}>
      {tags.map((t) => (
        <Badge key={t} size="sm" variant="light" color="gray">
          {t}
        </Badge>
      ))}
    </Group>
  );
}

function ViewDrawer({ doc, onClose }: { doc: KbDocument | null; onClose: () => void }) {
  const markdown = useMarkdown(doc?.id ?? null);
  const [raw, setRaw] = useState(false);

  return (
    <Drawer opened={doc !== null} onClose={onClose} position="right" size="xl" title={doc?.title ?? 'Документ'}>
      {doc && (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            {doc.originalName}
          </Text>
          {doc.summary && <Text size="sm">{doc.summary}</Text>}
          <Tags tags={doc.tags} />
          <Switch label="Как текст" checked={raw} onChange={(e) => setRaw(e.currentTarget.checked)} />
          {markdown.isPending ? (
            <Loading />
          ) : markdown.isError ? (
            <ErrorState error={markdown.error} onRetry={() => void markdown.refetch()} />
          ) : !markdown.data.trim() ? (
            <Empty text="Текст документа пуст" />
          ) : raw ? (
            <pre className="kb-pre kb-mono" style={{ maxHeight: 'none' }}>
              {markdown.data}
            </pre>
          ) : (
            <div className="kb-card">
              <Markdown>{markdown.data}</Markdown>
            </div>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

function MetaEditor({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const invalidate = useInvalidateDocuments();
  const [draft, setDraft] = useState<KbDocumentUpdate>({
    title: doc.title,
    summary: doc.summary ?? '',
    tags: doc.tags,
  });
  const save = useMutation({
    mutationFn: (body: KbDocumentUpdate) =>
      send<KbDocument>(docPath(doc.id), 'PUT', { ...body, title: body.title.trim(), summary: body.summary.trim() }),
    onSuccess: () => {
      notifications.show({ message: 'Описание сохранено', color: 'green' });
      onClose();
      return invalidate();
    },
    onError: (e) => notifications.show({ message: `Не сохранено: ${errorMessage(e)}`, color: 'red' }),
  });
  const noTitle = !draft.title.trim();

  return (
    <Stack gap="sm">
      <TextInput
        label="Название"
        required
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
        error={noTitle ? 'Обязательное поле' : undefined}
      />
      <Textarea
        label="Описание"
        description="О чём документ, 2–3 предложения"
        autosize
        minRows={3}
        maxRows={8}
        value={draft.summary}
        onChange={(e) => setDraft({ ...draft, summary: e.currentTarget.value })}
      />
      <TagsInput
        label="Теги"
        description="Enter добавляет тег"
        value={draft.tags}
        onChange={(tags) => setDraft({ ...draft, tags })}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={save.isPending}>
          Отмена
        </Button>
        <Button onClick={() => save.mutate(draft)} loading={save.isPending} disabled={noTitle}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}

function MarkdownEditor({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const markdown = useMarkdown(doc.id);
  if (markdown.isPending) return <Loading height={240} />;
  if (markdown.isError) return <ErrorState error={markdown.error} onRetry={() => void markdown.refetch()} />;
  // key: черновик создаётся заново из загруженного текста
  return <MarkdownForm key={doc.id} doc={doc} initial={markdown.data} onClose={onClose} />;
}

function MarkdownForm({ doc, initial, onClose }: { doc: KbDocument; initial: string; onClose: () => void }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateDocuments();
  const [text, setText] = useState(initial);
  const save = useMutation({
    mutationFn: (body: string) => sendText<KbDocument>(`${docPath(doc.id)}/markdown`, 'PUT', body, 'text/markdown'),
    onSuccess: async () => {
      notifications.show({ message: 'Текст сохранён', color: 'green' });
      onClose();
      await Promise.all([qc.invalidateQueries({ queryKey: queryKeys.kbMarkdown(doc.id) }), invalidate()]);
    },
    onError: (e) => notifications.show({ message: `Не сохранено: ${errorMessage(e)}`, color: 'red' }),
  });

  return (
    <Stack gap="sm">
      <Alert color="yellow" variant="light" p="xs" icon={<IconAlertTriangle size={16} />}>
        Бот будет отвечать по исправленному тексту.
      </Alert>
      <Textarea
        aria-label="Текст документа в Markdown"
        classNames={{ input: 'kb-mono' }}
        autosize
        minRows={18}
        maxRows={32}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        spellCheck={false}
      />
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Символов: {fmt(text.length)}
        </Text>
        <Group gap="xs">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button onClick={() => save.mutate(text)} loading={save.isPending} disabled={text === initial}>
            Сохранить
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

function DeleteConfirm({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const invalidate = useInvalidateDocuments();
  const remove = useMutation({
    mutationFn: () => del(docPath(doc.id)),
    onSuccess: () => {
      notifications.show({ message: `Документ «${doc.title}» удалён`, color: 'green' });
      onClose();
      return invalidate();
    },
    onError: (e) => notifications.show({ message: `Не удалено: ${errorMessage(e)}`, color: 'red' }),
  });
  return (
    <Stack gap="sm">
      <Text size="sm">
        Документ «{doc.title}» и его текст будут удалены, бот перестанет на него ссылаться. Отменить нельзя.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={remove.isPending}>
          Отмена
        </Button>
        <Button color="red" onClick={() => remove.mutate()} loading={remove.isPending}>
          Удалить
        </Button>
      </Group>
    </Stack>
  );
}

// ---------- таблица ----------

function StatusCell({ doc }: { doc: KbDocument }) {
  if (doc.status === 'processing') {
    return (
      <Group gap={6} wrap="nowrap">
        <Loader size={14} />
        <Text size="sm" c="dimmed">
          Обработка…
        </Text>
      </Group>
    );
  }
  if (doc.status === 'failed') {
    return (
      <Tooltip label={doc.error ?? 'Причина неизвестна'} multiline maw={320} withinPortal>
        <Badge size="sm" color="red" variant="light" tabIndex={0}>
          Ошибка
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Badge size="sm" color="green" variant="light">
      Готов
    </Badge>
  );
}

type Dialog = { kind: 'view' | 'meta' | 'markdown' | 'delete'; doc: KbDocument } | null;

function RowMenu({ doc, onOpen }: { doc: KbDocument; onOpen: (d: NonNullable<Dialog>) => void }) {
  const invalidate = useInvalidateDocuments();
  const reprocess = useMutation({
    mutationFn: () => send<KbDocument>(`${docPath(doc.id)}/reprocess`, 'POST'),
    onSuccess: () => {
      notifications.show({ message: `«${doc.title}» отправлен на обработку`, color: 'blue' });
      return invalidate();
    },
    onError: (e) => notifications.show({ message: `Не удалось: ${errorMessage(e)}`, color: 'red' }),
  });
  const processing = doc.status === 'processing';

  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Действия: ${doc.title}`} loading={reprocess.isPending}>
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onOpen({ kind: 'view', doc })}>
          Просмотр
        </Menu.Item>
        <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => onOpen({ kind: 'meta', doc })}>
          Изменить описание
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileText size={16} />}
          onClick={() => onOpen({ kind: 'markdown', doc })}
          disabled={processing}
        >
          Редактировать текст
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDownload size={16} />}
          component="a"
          href={apiUrl(`${docPath(doc.id)}/markdown?download=true`)}
          download
        >
          Скачать .md
        </Menu.Item>
        <Menu.Item
          leftSection={<IconRefresh size={16} />}
          onClick={() => reprocess.mutate()}
          disabled={processing || reprocess.isPending}
        >
          Обработать заново
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => onOpen({ kind: 'delete', doc })}>
          Удалить
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function DocumentsCard() {
  const documents = useQuery({
    queryKey: queryKeys.kbDocuments,
    queryFn: ({ signal }) => get<KbDocument[]>('/admin/kb/documents', signal),
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === 'processing') ? POLL_PROCESSING_MS : false),
  });
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = documents.data ?? [];
    if (!q) return list;
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.originalName.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [documents.data, search]);

  if (documents.isPending) return <Loading height={240} />;
  if (documents.isError) return <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />;

  // Открытый документ берём из свежего списка: после правки в окне просмотра видно новое описание
  const fresh = (d: KbDocument) => documents.data.find((x) => x.id === d.id) ?? d;
  const current = dialog ? { ...dialog, doc: fresh(dialog.doc) } : null;

  return (
    <div className="kb-card">
      <Group justify="space-between" align="flex-end" gap="sm">
        <div>
          <div className="kb-card-title">Документы</div>
          <div className="kb-card-sub">
            {documents.data.length
              ? `Всего: ${fmt(documents.data.length)}. Бот отвечает только по документам со статусом «Готов».`
              : 'Бот отвечает только по документам из этого списка.'}
          </div>
        </div>
        {documents.data.length > 0 && (
          <TextInput
            placeholder="Поиск по названию и тегам"
            aria-label="Поиск по названию и тегам"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={{ base: '100%', sm: 280 }}
          />
        )}
      </Group>

      {documents.data.length === 0 ? (
        <Empty text="База знаний пуста — загрузите первый документ" />
      ) : shown.length === 0 ? (
        <Empty text="Ничего не найдено" />
      ) : (
        <Table.ScrollContainer minWidth={860} mt="sm">
          <Table verticalSpacing={8} fz="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Описание</Table.Th>
                <Table.Th>Теги</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th className="kb-num">Размер</Table.Th>
                <Table.Th className="kb-num">Фрагментов</Table.Th>
                <Table.Th>Загружен</Table.Th>
                <Table.Th aria-label="Действия" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td maw={260}>
                    <Text size="sm" fw={600} lineClamp={2}>
                      {d.title}
                    </Text>
                    <Text size="xs" c="dimmed" truncate title={d.originalName}>
                      {d.originalName}
                    </Text>
                  </Table.Td>
                  <Table.Td maw={320}>
                    {d.summary ? (
                      <Tooltip label={d.summary} multiline maw={360} withinPortal openDelay={300}>
                        <Text size="sm" lineClamp={2}>
                          {d.summary}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td maw={200}>
                    <Tags tags={d.tags} />
                  </Table.Td>
                  <Table.Td>
                    <StatusCell doc={d} />
                  </Table.Td>
                  <Table.Td className="kb-num">
                    {fmtSize(d.originalSize)}
                    {d.markdownSize !== null && ` → ${fmtSize(d.markdownSize)}`}
                  </Table.Td>
                  <Table.Td className="kb-num">{fmt(d.chunks)}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(d.createdAt)}</Table.Td>
                  <Table.Td>
                    <RowMenu doc={d} onOpen={setDialog} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <ViewDrawer doc={current?.kind === 'view' ? current.doc : null} onClose={close} />
      <Modal opened={current?.kind === 'meta'} onClose={close} title="Описание документа" size="lg">
        {current?.kind === 'meta' && <MetaEditor key={current.doc.id} doc={current.doc} onClose={close} />}
      </Modal>
      <Modal
        opened={current?.kind === 'markdown'}
        onClose={close}
        title={current ? `Текст: ${current.doc.title}` : 'Текст'}
        size="100%"
      >
        {current?.kind === 'markdown' && <MarkdownEditor doc={current.doc} onClose={close} />}
      </Modal>
      <Modal opened={current?.kind === 'delete'} onClose={close} title="Удалить документ?">
        {current?.kind === 'delete' && <DeleteConfirm doc={current.doc} onClose={close} />}
      </Modal>
    </div>
  );
}

// ---------- вопросы без ответа ----------

function QuestionsCard() {
  const [all, setAll] = useState(false);
  const unanswered = !all;
  const questions = useQuery({
    queryKey: queryKeys.kbQuestions(unanswered),
    queryFn: ({ signal }) =>
      get<KbQuestion[]>(`/admin/kb/questions?unanswered=${unanswered}&limit=${QUESTIONS_LIMIT}`, signal),
  });

  return (
    <div className="kb-card">
      <Group justify="space-between" align="flex-start" gap="sm">
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="kb-card-title">{all ? 'Вопросы посетителей' : 'Вопросы без ответа'}</div>
          <div className="kb-card-sub">
            {all
              ? `Последние ${QUESTIONS_LIMIT} вопросов, заданных в чате.`
              : 'На эти вопросы посетителей в базе знаний ничего не нашлось — возможно, стоит добавить документ.'}
          </div>
        </div>
        <Switch label="Все вопросы" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
      </Group>
      {questions.isPending ? (
        <Loading />
      ) : questions.isError ? (
        <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
      ) : questions.data.length === 0 ? (
        <Empty text={all ? 'Вопросов пока не было' : 'Вопросов без ответа нет'} />
      ) : (
        <Table.ScrollContainer minWidth={480} mt="sm">
          <Table verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={150}>Когда</Table.Th>
                <Table.Th>Вопрос</Table.Th>
                {all && <Table.Th w={130}>Найдено</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {questions.data.map((q) => (
                <Table.Tr key={q.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(q.askedAt)}</Table.Td>
                  <Table.Td style={{ overflowWrap: 'anywhere' }}>{q.question}</Table.Td>
                  {all && (
                    <Table.Td>
                      <Badge size="sm" variant="light" color={q.found ? 'green' : 'gray'}>
                        {q.found ? 'Есть ответ' : 'Ничего'}
                      </Badge>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </div>
  );
}

export function KnowledgeBasePage() {
  return (
    <Stack gap="md">
      <UploadZone />
      <DocumentsCard />
      <QuestionsCard />
    </Stack>
  );
}
