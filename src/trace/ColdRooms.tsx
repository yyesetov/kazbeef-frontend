// Холодильные камеры: плитка на камеру — текущая температура крупно, тренд за час, шкала нормы,
// график за 3 часа с подсказкой по наведению и прогноз, когда камера выйдет за норму при нынешнем темпе.
import { useId, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  IconArrowNarrowRight,
  IconBellRinging,
  IconMinus,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { fmt } from '../lib/format';
import { fmtTemp, lotsWord, rangeText } from './format';
import { READING_MINUTES, fmtHours, roomOf, roomTrend, type RoomLevel } from './model';
import type { ColdRoom, Lot, StageId, TraceOverview } from './types';

const LEVEL_LABEL: Record<RoomLevel, string> = { ok: 'В норме', warn: 'Близко к границе', bad: 'Вне нормы' };
const LEVEL_RANK: Record<RoomLevel, number> = { bad: 0, warn: 1, ok: 2 };

/** Скорость за час; меньше 0,05 °C/ч — «стабильно», без «−0». */
const fmtRate = (perHour: number) => {
  const v = Math.round(perHour * 10) / 10;
  if (!v) return 'стабильно';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('ru-RU')} °C/ч`;
};

/** Шкала значений графика и шкалы нормы: норма плюс запас, чтобы выход за неё был виден. */
function scaleOf(room: ColdRoom) {
  const span = room.max - room.min;
  const pad = Math.max(0.6, span * 0.3);
  const lo = Math.min(room.min - pad, ...room.readings);
  const hi = Math.max(room.max + pad, ...room.readings);
  return { lo, hi, pos: (v: number) => (v - lo) / (hi - lo) };
}

/** Горизонтальный термометр: полоса нормы и метка текущей температуры. */
function RangeGauge({ room, level }: { room: ColdRoom; level: RoomLevel }) {
  const { pos } = scaleOf(room);
  const current = room.readings[room.readings.length - 1] ?? room.min;
  return (
    <div
      className="kb-gauge"
      data-level={level}
      role="img"
      aria-label={`Сейчас ${fmtTemp(current)}, норма ${rangeText(room.min, room.max)}`}
    >
      <div className="kb-gauge-track">
        <span
          className="kb-gauge-band"
          style={{ left: `${pos(room.min) * 100}%`, right: `${(1 - pos(room.max)) * 100}%` }}
        />
        <span className="kb-gauge-mark" style={{ left: `${pos(current) * 100}%` }} />
      </div>
      <div className="kb-gauge-labels">
        <span style={{ left: `${pos(room.min) * 100}%` }}>{fmtTemp(room.min, false)}</span>
        <span style={{ left: `${pos(room.max) * 100}%` }}>{fmtTemp(room.max, false)}</span>
      </div>
    </div>
  );
}

const W = 300;
const H = 76;

/** График за 3 часа. Линия синяя в норме и красная за её границами; наведение показывает показание. */
function TempChart({ room, level }: { room: ColdRoom; level: RoomLevel }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const { pos } = scaleOf(room);
  const n = room.readings.length;
  const x = (i: number) => (i / Math.max(1, n - 1)) * W;
  const y = (v: number) => H - pos(v) * H;
  const pts = room.readings.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const yMax = y(room.max);
  const yMin = y(room.min);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const shown = hover ?? n - 1;
  const value = room.readings[shown] ?? 0;
  const ago = (n - 1 - shown) * READING_MINUTES;
  const lo = Math.min(...room.readings);
  const hi = Math.max(...room.readings);

  return (
    <figure
      className="kb-chart"
      data-level={level}
      aria-label={`Температура за 3 часа: от ${fmtTemp(lo)} до ${fmtTemp(hi)}`}
    >
      <div className="kb-chart-plot" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            {/* Цвет линии зависит от высоты: за границами нормы — красный */}
            <linearGradient id={`s${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
              <stop offset={yMax / H} style={{ stopColor: 'var(--kb-hot)' }} />
              <stop offset={yMax / H} style={{ stopColor: 'var(--kb-series-1)' }} />
              <stop offset={yMin / H} style={{ stopColor: 'var(--kb-series-1)' }} />
              <stop offset={yMin / H} style={{ stopColor: 'var(--kb-hot)' }} />
            </linearGradient>
            <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--kb-line)', stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: 'var(--kb-line)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <rect x={0} y={yMax} width={W} height={yMin - yMax} className="kb-chart-band" />
          <line x1={0} x2={W} y1={yMax} y2={yMax} className="kb-chart-limit" />
          <line x1={0} x2={W} y1={yMin} y2={yMin} className="kb-chart-limit" />
          <g className="kb-chart-draw">
            <path d={area} fill={`url(#a${id})`} />
            <path d={line} fill="none" stroke={`url(#s${id})`} className="kb-chart-line" />
          </g>
        </svg>
        {hover !== null && <span className="kb-chart-guide" style={{ left: `${(x(hover) / W) * 100}%` }} />}
        <span
          className="kb-chart-dot"
          data-live={hover === null || undefined}
          data-out={value < room.min || value > room.max || undefined}
          style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(value) / H) * 100}%` }}
        />
        <span
          className="kb-chart-tip"
          data-visible={hover !== null || undefined}
          style={{ '--x': `${(x(shown) / W) * 100}%` } as CSSProperties}
        >
          <b>{fmtTemp(value)}</b> {ago ? `${fmtHours(ago / 60)} назад` : 'сейчас'}
        </span>
      </div>
      <figcaption className="kb-chart-axis" aria-hidden>
        <span>3 ч назад</span>
        <span>2 ч</span>
        <span>1 ч</span>
        <span>сейчас</span>
      </figcaption>
    </figure>
  );
}

function Fridge({
  room,
  data,
  lots,
  index,
  onShowStage,
}: {
  room: ColdRoom;
  data: TraceOverview;
  lots: Lot[];
  index: number;
  onShowStage: (id: StageId) => void;
}) {
  const t = roomTrend(room);
  const stage = data.stages.find((s) => s.id === room.stageId);
  const kg = lots.reduce((s, l) => s + l.weightKg, 0);
  const TrendIcon = Math.abs(t.perHour) < 0.1 ? IconMinus : t.perHour > 0 ? IconTrendingUp : IconTrendingDown;
  // Теплеет — плохо для любой камеры; холодеет — плохо только у нижней границы
  const trendBad = t.perHour >= 0.3 || (t.perHour <= -0.3 && t.current - room.min < (room.max - room.min) * 0.3);

  let message: string;
  if (t.level === 'bad') {
    message = `${t.current > room.max ? 'Теплее' : 'Холоднее'} нормы ${t.outMinutes ? `уже ${fmtHours(t.outMinutes / 60)}` : 'с последнего показания'}. Оповещение уходит в Telegram.`;
  } else if (t.etaMinutes !== null) {
    message = `При нынешнем темпе дойдёт до ${fmtTemp(t.bound)} примерно через ${fmtHours(Math.max(t.etaMinutes, READING_MINUTES) / 60)}.`;
  } else if (t.level === 'warn') {
    message = 'Температура у самой границы нормы — проверьте дверь и уплотнитель.';
  } else {
    message = 'Стабильно в норме за последний час.';
  }

  return (
    <article className="kb-fridge" data-level={t.level} style={{ '--i': index } as CSSProperties}>
      <header className="kb-fridge-head">
        <span className="kb-pill" data-level={t.level}>
          <span className="kb-live" aria-hidden />
          {LEVEL_LABEL[t.level]}
        </span>
        <div className="kb-fridge-name">{room.name}</div>
        <div className="kb-fridge-meta">
          {stage?.name}
          {room.chain ? ` · ${room.chain === 'chilled' ? 'охлаждённая' : 'замороженная'}` : ''}
        </div>
      </header>

      <div className="kb-fridge-now">
        <span className="kb-fridge-temp">
          {fmtTemp(t.current, false)}
          <small>°C</small>
        </span>
        {/* Норма — на шкале ниже; строка всегда одной высоты, поэтому графики соседних камер на одном уровне */}
        <div className="kb-fridge-sub">
          <span
            className="kb-fridge-trend"
            data-bad={trendBad || undefined}
            title="Скорость изменения за последний час"
          >
            <TrendIcon size={16} stroke={2} aria-hidden />
            {fmtRate(t.perHour)}
          </span>
        </div>
      </div>

      <RangeGauge room={room} level={t.level} />
      <TempChart room={room} level={t.level} />

      <p className="kb-fridge-msg">
        {t.level === 'bad' && <IconBellRinging size={14} aria-hidden />}
        {message}
      </p>

      <footer className="kb-fridge-foot">
        <span>
          {lots.length
            ? `Внутри ${fmt(lots.length)} ${lotsWord(lots.length)} · ${fmt(Math.round(kg))} кг`
            : 'Партий внутри нет'}
        </span>
        {stage && (
          <button type="button" className="kb-link-btn" onClick={() => onShowStage(room.stageId)}>
            К партиям этапа
            <IconArrowNarrowRight size={15} aria-hidden className="kb-arrow" />
          </button>
        )}
      </footer>
    </article>
  );
}

export function ColdRooms({
  data,
  updatedAt,
  onShowStage,
}: {
  data: TraceOverview;
  updatedAt: number;
  onShowStage: (id: StageId) => void;
}) {
  const rooms = data.rooms
    .map((r) => ({ r, level: roomTrend(r).level }))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
  const count = (l: RoomLevel) => rooms.filter((x) => x.level === l).length;
  const active = data.lots.filter((l) => l.status !== 'split' && l.stageId !== 'delivered');

  return (
    <section className="kb-card" aria-labelledby="kb-rooms-title">
      <div className="kb-process-head">
        <div>
          <div className="kb-card-title" id="kb-rooms-title">
            Холодильные камеры
          </div>
          <div className="kb-card-sub">
            Датчик присылает показание раз в {READING_MINUTES} минут, график — за последние 3 часа. Наведите на график,
            чтобы увидеть показание.
          </div>
        </div>
        <div className="kb-rooms-summary">
          {count('bad') > 0 && (
            <span className="kb-pill" data-level="bad">
              <span className="kb-live" aria-hidden />
              Вне нормы: {count('bad')}
            </span>
          )}
          {count('warn') > 0 && (
            <span className="kb-pill" data-level="warn">
              У границы: {count('warn')}
            </span>
          )}
          <span className="kb-pill" data-level="ok">
            В норме: {count('ok')}
          </span>
          <span className="kb-rooms-updated">
            обновлено в {new Date(updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div className="kb-fridges">
        {rooms.map(({ r }, i) => (
          <Fridge
            key={r.id}
            room={r}
            data={data}
            index={i}
            lots={active.filter((l) => roomOf(l, data.rooms)?.id === r.id)}
            onShowStage={onShowStage}
          />
        ))}
      </div>
    </section>
  );
}
