import clsx from 'clsx';
import { ArrowUpCircle, Plus, Timer } from 'lucide-react';
import { STUDY_LEVEL, STUDY_LEVEL_LABEL, type StudySubject } from '@kortex/shared';
import { Button, IconButton, Progress } from '../../components/ui';
import { useFocus } from '../../stores/focus';
import { todayStr } from '../../lib/dates';
import { formatDuration, formatHours } from '../../lib/duration';
import { timeAgo } from '../../lib/format';
import { FRESHNESS_LABEL, freshness, levelIndex, nextLevel, type Freshness } from './meta';

const FRESH_COLOR: Record<Freshness, string> = {
  today: '#4DF5B8',
  recent: '#6FE3FF',
  cooling: '#FFD166',
  cold: '#FF6B6B',
  never: '#9AA3B2',
};

/** Trilha de 3 níveis: Iniciante → Intermediário → Avançado. */
export function LevelTrack({ level, color }: { level: StudySubject['level']; color: string }) {
  const idx = levelIndex(level);
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Nível: ${STUDY_LEVEL_LABEL[level]}`}
      role="img"
    >
      {STUDY_LEVEL.map((l, i) => (
        <span
          key={l}
          className={clsx('h-1.5 flex-1 rounded-full', i > idx && 'bg-line')}
          style={
            i <= idx
              ? { background: color, boxShadow: i === idx ? `0 0 8px ${color}` : undefined }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function SubjectCard({
  subject: s,
  onOpen,
  onLog,
  onLevelUp,
}: {
  subject: StudySubject;
  onOpen: () => void;
  onLog: () => void;
  onLevelUp: () => void;
}) {
  const openFocus = useFocus((st) => st.openSetup);
  const fresh = freshness(s.lastStudiedAt, todayStr());
  const next = nextLevel(s.level);
  const goalPct = s.targetHours ? Math.min(100, (s.totalSec / 3600 / s.targetHours) * 100) : null;

  return (
    <article
      className={clsx(
        'group flex flex-col rounded-3xl bg-bg p-5 shadow-neu transition-all duration-200 hover:-translate-y-0.5',
      )}
    >
      <button type="button" onClick={onOpen} className="flex-1 text-left">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1 size-3 shrink-0 rounded-full"
            style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{s.name}</h2>
            <p className="text-xs text-muted">{STUDY_LEVEL_LABEL[s.level]}</p>
          </div>
        </div>
        <div className="mt-3">
          <LevelTrack level={s.level} color={s.color} />
        </div>
        <div className="mt-4">
          <Progress
            label="Progresso no nível"
            value={s.progress}
            showValue
            color={s.color}
            size="sm"
          />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Semana" value={formatDuration(s.weekSec)} />
          <Stat label="Total" value={formatHours(s.totalSec)} />
          <Stat label="Sessões" value={String(s.sessions)} />
        </dl>

        {goalPct != null && (
          <p className="mt-3 text-[11px] text-muted">
            Meta: {formatHours(s.totalSec)} de {s.targetHours}h ({Math.round(goalPct)}%)
          </p>
        )}
      </button>

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: FRESH_COLOR[fresh], boxShadow: `0 0 6px ${FRESH_COLOR[fresh]}` }}
          />
          <span className="truncate" title={FRESHNESS_LABEL[fresh]}>
            {s.lastStudiedAt ? `Última: ${timeAgo(s.lastStudiedAt)}` : FRESHNESS_LABEL.never}
          </span>
        </span>
        {s.progress >= 100 && next ? (
          <Button
            size="sm"
            variant="primary"
            icon={<ArrowUpCircle className="size-4" />}
            onClick={onLevelUp}
          >
            {STUDY_LEVEL_LABEL[next]}
          </Button>
        ) : (
          !s.archived && (
            <div className="flex gap-2">
              <IconButton
                label={`Focar em ${s.name}`}
                size="sm"
                onClick={() =>
                  openFocus({ module: 'study', refId: s.id, label: `Estudo · ${s.name}` })
                }
              >
                <Timer className="size-4 text-accent-ink" />
              </IconButton>
              <Button size="sm" icon={<Plus className="size-4" />} onClick={onLog}>
                Sessão
              </Button>
            </div>
          )
        )}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-2 py-2 shadow-neu-inset-sm">
      <dt className="text-[10px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
