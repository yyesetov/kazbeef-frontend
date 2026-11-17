// Схема процесса: этапы на одной линии слева направо, над ними — фазы (туша → ящики → отгрузка)
// и обход шоковой заморозки для охлаждённой продукции. На телефоне линия встаёт вертикально.
import type { CSSProperties, KeyboardEvent } from 'react';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconChevronRight,
  IconClockExclamation,
  IconClockHour4,
  IconHandStop,
  IconTemperature,
} from '@tabler/icons-react';
import { fmt } from '../lib/format';
import { fmtTemp, lotsWord, rangeText, windowText } from './format';
import { STAGE_ICON } from './icons';
import { dwell, roomTrend, stageIssues, type RoomLevel } from './model';
import type { StageId, TraceOverview } from './types';

/** Фазы над линией: где продукция — ещё туша, где уже ящики со своим QR, где — в пути. */
const PHASES: { label: string; from: StageId; to: StageId }[] = [
  { label: 'Туша', from: 'slaughter', to: 'cutting' },
  { label: 'Ящики со своим QR', from: 'packing', to: 'storage' },
  { label: 'Отгрузка', from: 'shipping', to: 'delivered' },
];

type NodeState = 'bad' | 'warn' | 'ok' | 'idle';

const LEVEL_RANK: Record<RoomLevel, number> = { ok: 0, warn: 1, bad: 2 };

export function ProcessMap({
  data,
  selected,
  onSelect,
}: {
  data: TraceOverview;
  selected: StageId;
  onSelect: (id: StageId) => void;
}) {
  const { stages } = data;
  const col = (id: StageId) => stages.findIndex((s) => s.id === id) + 1;
  const now = Date.now();

  // Этап только для одной цепочки: вторая обходит его дугой от соседа слева к соседу справа
  const bypasses = stages
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.only && i > 0 && i < stages.length - 1)
    .map(({ s, i }) => ({
      id: s.id,
      from: i,
      to: i + 2,
      label: s.only === 'frozen' ? 'охлаждённая — без заморозки' : 'другая цепочка — в обход',
    }));

  const move = (e: KeyboardEvent, i: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = stages[(i + step + stages.length) % stages.length];
    if (!next) return;
    onSelect(next.id);
    document.getElementById(`kb-node-${next.id}`)?.focus();
  };

  return (
    <section className="kb-card kb-process" aria-labelledby="kb-process-title">
      <div className="kb-process-head">
        <div>
          <div className="kb-card-title" id="kb-process-title">
            Схема процесса
          </div>
          <div className="kb-card-sub">
            Каждая стрелка — передача между отделами со сканированием QR. Выберите этап, чтобы увидеть его партии.
          </div>
        </div>
        <ul className="kb-process-legend" aria-label="Обозначения">
          <li>
            <i className="kb-legend-dot ok" /> В норме
          </li>
          <li>
            <i className="kb-legend-dot warn" /> Возврат, задержка или срок на исходе
          </li>
          <li>
            <i className="kb-legend-dot bad" /> Передержка или камера вне нормы
          </li>
        </ul>
      </div>

      <div className="kb-process-scroll">
        <div
          className="kb-pipe"
          style={{ '--n': stages.length } as CSSProperties}
          role="tablist"
          aria-label="Этапы процесса"
        >
          {PHASES.map((p, i) => (
            <div
              key={p.label}
              className="kb-phase"
              style={{ gridColumn: `${col(p.from)} / ${col(p.to) + 1}`, '--i': i } as CSSProperties}
              aria-hidden
            >
              <span>{p.label}</span>
            </div>
          ))}
          {bypasses.map((b) => (
            <div key={b.id} className="kb-bypass" style={{ gridColumn: `${b.from} / ${b.to + 1}` }} aria-hidden>
              <span>{b.label}</span>
            </div>
          ))}

          {stages.map((s, i) => {
            const issues = stageIssues(s.id, data.lots, stages, data.rooms, now);
            const kg = issues.lots.reduce((sum, l) => sum + l.weightKg, 0);
            const soon = issues.lots.filter((l) => dwell(l, s, now).state === 'soon').length;
            const rooms = data.rooms.filter((r) => r.stageId === s.id).map((r) => ({ r, t: roomTrend(r) }));
            const worstRoom = rooms.sort((a, b) => LEVEL_RANK[b.t.level] - LEVEL_RANK[a.t.level])[0];
            const state: NodeState =
              issues.over || issues.warmRooms.length
                ? 'bad'
                : issues.returned || issues.hold || soon || worstRoom?.t.level === 'warn'
                  ? 'warn'
                  : issues.lots.length
                    ? 'ok'
                    : 'idle';
            const Icon = STAGE_ICON[s.id];
            const range = rangeText(s.tempMin, s.tempMax);
            const term = windowText(s);
            const active = selected === s.id;
            return (
              <button
                key={s.id}
                id={`kb-node-${s.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="kb-stage-panel"
                tabIndex={active ? 0 : -1}
                className="kb-node"
                data-state={state}
                data-active={active || undefined}
                data-only={s.only || undefined}
                style={{ gridColumn: i + 1, '--i': i } as CSSProperties}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => move(e, i)}
              >
                <span className="kb-node-rail">
                  <span className="kb-node-dot">
                    <Icon size={18} stroke={1.7} />
                  </span>
                  {i < stages.length - 1 && <IconChevronRight className="kb-node-arrow" size={14} stroke={2.4} />}
                </span>
                <span className="kb-node-body">
                  <span className="kb-node-step">Этап {i + 1}</span>
                  <span className="kb-node-name">{s.name}</span>
                  <span className="kb-node-count">
                    {issues.lots.length ? fmt(issues.lots.length) : '—'}
                    <small>
                      {issues.lots.length ? `${lotsWord(issues.lots.length)} · ${fmt(Math.round(kg))} кг` : 'пусто'}
                    </small>
                  </span>
                  {(range || term) && (
                    <span className="kb-node-norms">
                      {range && (
                        <span>
                          <IconTemperature size={12} aria-hidden />
                          {range}
                        </span>
                      )}
                      {term && (
                        <span>
                          <IconClockHour4 size={12} aria-hidden />
                          {term}
                        </span>
                      )}
                    </span>
                  )}
                  {worstRoom && (
                    <span className="kb-node-room" data-level={worstRoom.t.level}>
                      <span className="kb-live" aria-hidden />
                      Камера: {fmtTemp(worstRoom.t.current)}
                    </span>
                  )}
                  <span className="kb-node-flags">
                    {issues.over > 0 && (
                      <span className="kb-flag bad">
                        <IconClockExclamation size={12} aria-hidden />
                        Передержка: {issues.over}
                      </span>
                    )}
                    {issues.warmRooms.length > 0 && (
                      <span className="kb-flag bad">
                        <IconAlertTriangle size={12} aria-hidden />
                        Камера вне нормы
                      </span>
                    )}
                    {issues.returned > 0 && (
                      <span className="kb-flag warn">
                        <IconArrowBackUp size={12} aria-hidden />
                        Возврат: {issues.returned}
                      </span>
                    )}
                    {issues.hold > 0 && (
                      <span className="kb-flag warn">
                        <IconHandStop size={12} aria-hidden />
                        Задержано: {issues.hold}
                      </span>
                    )}
                    {soon > 0 && (
                      <span className="kb-flag warn">
                        <IconClockHour4 size={12} aria-hidden />
                        Срок на исходе: {soon}
                      </span>
                    )}
                    {state === 'ok' && (
                      <span className="kb-flag ok">
                        <IconCheck size={12} aria-hidden />В норме
                      </span>
                    )}
                    {s.only === 'frozen' && <span className="kb-flag only">Только замороженная</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
