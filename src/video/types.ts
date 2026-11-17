// Видеомониторинг: помещения, камеры с ИИ-разбором кадра, правила и журнал нарушений.
// Бэкенда пока нет: формы ниже — договорённость, под которую он будет сделан. Когда появится API,
// меняется только src/video/api.ts, страница остаётся как есть.
//
// Предполагаемый контракт:
//   GET  /api/video/overview                 → VideoOverview
//   GET  /api/video/events?room=&severity=   → VideoEvent[]
//   POST /admin/video/events/{id}/review     { verdict: 'confirmed' | 'false' } — разметка для дообучения ИИ
// Грубые нарушения бэкенд сам пишет в журнал и отправляет в Telegram-бот (тот же канал, что у оповещений).

/** Грубое — сразу в Telegram; нарушение и замечание — только в журнал. */
export type Severity = 'gross' | 'violation' | 'notice';

export type CameraStatus = 'online' | 'offline';

export type Camera = {
  id: string;
  roomId: string;
  name: string;
  status: CameraStatus;
  /** ИИ разбирает поток этой камеры */
  aiEnabled: boolean;
  /**
   * Адрес потока для <video>. null — поток ещё не подключён.
   * Планируется HLS (.m3u8) или WebRTC через медиасервер; RTSP камер браузер напрямую не играет.
   */
  streamUrl: string | null;
};

export type Room = {
  id: string;
  /** «Помещение 1» */
  name: string;
  /** Назначение: коровник, телятник, зона дезинфекции… */
  purpose: string;
};

export type Rule = {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  /** Помещения, где правило действует; пусто — везде */
  roomIds: string[];
  enabled: boolean;
};

/** Разметка события человеком: на ней ИИ дообучается. */
export type Review = 'pending' | 'confirmed' | 'false';

export type VideoEvent = {
  id: string;
  /** ISO-время */
  at: string;
  roomId: string;
  cameraId: string;
  ruleId: string;
  severity: Severity;
  /** Уверенность модели, 0–1 */
  confidence: number;
  /** Что увидела модель — для журнала */
  note: string;
  /** Отправлено в Telegram (только для грубых) */
  telegram: 'sent' | 'failed' | null;
  review: Review;
};

export type VideoOverview = {
  rooms: Room[];
  cameras: Camera[];
  rules: Rule[];
  events: VideoEvent[];
  /** true — данные демонстрационные, камеры не подключены */
  demo: boolean;
};
