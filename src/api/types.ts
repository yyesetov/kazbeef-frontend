// Формы ответов бэкенда. Сняты с контроллеров и SQL-запросов (EventQueries, *AdminController):
// при изменении API правится этот файл, и компилятор показывает все места, которые нужно поправить.

export type EventStatus = 'new' | 'ongoing' | 'closed';
export type TrustLevel = 'confirmed' | 'signal' | 'analytics';
export type SpeciesGroup = 'CATTLE' | 'SMALL_RUMINANT' | 'OTHER';
export type RunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RUNNING';

/** Показатели, по которым строятся графики. */
export type Metric = 'events' | 'outbreaks' | 'cases';
export type Interval = 'week' | 'month';

export type Me = { username: string; roles: string[]; admin: boolean };

export type Csrf = { headerName: string; token: string };

// ---------- события ----------

export type EventItem = {
  id: number;
  title: string | null;
  status: EventStatus;
  trustLevel: TrustLevel;
  diseaseId: number | null;
  diseaseCode: string | null;
  disease: string;
  iso3: string | null;
  country: string;
  priorityCountry: boolean;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Даты приходят строками YYYY-MM-DD */
  startDate: string | null;
  reportDate: string | null;
  eventDate: string | null;
  outbreaks: number | null;
  susceptible: number | null;
  cases: number | null;
  deaths: number | null;
  ruminantRelevant: boolean;
  riskScore: number | null;
  distanceKm: number | null;
  rawSpecies: string | null;
  /** Названия видов через запятую */
  species: string | null;
  speciesGroups: string | null;
  /** Коды источников через запятую */
  sources: string | null;
  aiSummary: string | null;
};

export type SourceRecord = {
  code: string;
  name: string;
  trustLevel: TrustLevel;
  externalId: string;
  url: string | null;
  fetchedAt: string | null;
  /** Исходный ответ источника: JSON строкой */
  rawPayload: string | null;
};

export type EventDetail = EventItem & {
  description: string | null;
  translation: string | null;
  aiGenerated: boolean;
  rawDiseaseName: string | null;
  rawCountryName: string | null;
  diseaseEn: string | null;
  diseaseSeverity: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  sourceRecords: SourceRecord[];
};

export type EventPage = { items: EventItem[]; total: number };

export type MapPoint = {
  id: number;
  lat: number;
  lon: number;
  title: string | null;
  status: EventStatus;
  region: string | null;
  diseaseId: number | null;
  disease: string;
  country: string;
  iso3: string | null;
  eventDate: string | null;
  outbreaks: number | null;
  cases: number | null;
  deaths: number | null;
  riskScore: number | null;
  distanceKm: number | null;
  trustLevel: TrustLevel;
};

// ---------- статистика ----------

export type Summary = {
  events: number;
  newLast7d: number;
  active: number;
  outbreaks: number;
  cases: number;
  deaths: number;
  countries: number;
  diseases: number;
  maxRisk: number | null;
  inKazakhstan: number;
  nearBorder: number;
  lastReportDate: string | null;
};

export type SeriesRow = {
  /** Начало периода, YYYY-MM-DD */
  period: string;
  key: string;
  label: string;
  events: number;
  outbreaks: number;
  cases: number;
  deaths: number;
};

export type AggRow = {
  key: string | null;
  label: string;
  events: number;
  active: number;
  outbreaks: number;
  cases: number;
  deaths: number;
  maxRisk: number | null;
};
export type SpeciesAggRow = AggRow & { group: SpeciesGroup };
export type SourceAggRow = AggRow & { trustLevel: TrustLevel };

export type MatrixRow = { disease: string; country: string; events: number; outbreaks: number; cases: number };

// ---------- справочники ----------

export type RefCountry = { iso3: string; name: string; priority: boolean; events: number };
export type RefDisease = {
  id: number;
  code: string | null;
  name: string;
  nameEn: string;
  severity: number;
  needsReview: boolean;
  events: number;
  ruminant: boolean;
};
export type RefSpecies = { id: number; name: string; nameEn: string; group: SpeciesGroup };
export type RefSource = {
  code: string;
  name: string;
  url: string | null;
  trustLevel: TrustLevel;
  active: boolean;
  note: string | null;
};
export type Reference = {
  countries: RefCountry[];
  diseases: RefDisease[];
  species: RefSpecies[];
  sources: RefSource[];
};

// ---------- админка ----------

export type CollectorRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  fetched: number;
  created: number;
  updated: number;
  failed: number;
  error: string | null;
};

export type CollectorSource = {
  code: string;
  name: string;
  trustLevel: TrustLevel;
  active: boolean;
  hasCollector: boolean;
  running: boolean;
  lastSuccessAt: string | null;
  note: string | null;
  recentRuns: CollectorRun[];
};

export type SystemState = {
  ai: { enabled: boolean; model: string | null; processed: number; total: number };
  notify: { channels: string[]; alertsSent: number; lastError: string | null };
};

export type AdminDisease = {
  id: number;
  code: string | null;
  nameRu: string | null;
  nameEn: string;
  severity: number;
  needsReview: boolean;
  events: number;
  /** JSON-массив строк, приходит текстом */
  synonyms: string | null;
  /** JSON-массив чисел, приходит текстом */
  speciesIds: string | null;
};

export type DiseaseUpdate = {
  nameRu: string;
  nameEn: string;
  code: string;
  severity: number;
  synonyms: string[];
  speciesIds: number[];
};

// ---------- база знаний (/admin/kb/**) ----------

export type KbStatus = 'processing' | 'ready' | 'failed';

export type KbDocument = {
  id: number;
  originalName: string;
  format: string;
  originalSize: number;
  title: string;
  summary: string | null;
  tags: string[];
  status: KbStatus;
  error: string | null;
  markdownSize: number | null;
  chars: number | null;
  chunks: number | null;
  createdAt: string;
  updatedAt: string;
};

export type KbDocumentUpdate = { title: string; summary: string; tags: string[] };

export type KbFormats = { extensions: string[]; maxFileSizeMb: number };

/** Ответ загрузки по каждому файлу: принят (есть id) или отклонён с причиной. */
export type KbUploadResult = { name: string; id?: number; status: KbStatus | 'rejected'; error?: string };

export type KbQuestion = {
  id: number;
  askedAt: string;
  question: string;
  found: boolean;
  /** JSON-массив идентификаторов документов строкой */
  documentIds: string;
};
