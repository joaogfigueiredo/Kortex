import { useState } from 'react';
import clsx from 'clsx';
import { Check, Flame, Settings2, Target } from 'lucide-react';
import { ProgressRing } from '../../components/charts/ProgressRing';
import { Card } from '../../components/ui';
import { todayStr } from '../../lib/dates';
import { toast } from '../../stores/toast';
import { useGoalMutations, useGoalsOfDay } from './api';
import { GoalsModal } from './GoalsModal';
import { goalIcon } from './icons';

/** Metas de hoje com check rápido (Home). */
export function TodayGoals() {
  const today = todayStr();
  const { data: goals = [], isLoading } = useGoalsOfDay(today);
  const { check } = useGoalMutations();
  const [manage, setManage] = useState(false);
  const done = goals.filter((g) => g.done).length;

  function toggle(id: number, wasDone: boolean) {
    check.mutate(
      { id, date: today, done: !wasDone },
      {
        onSuccess: () => {
          if (!wasDone && done + 1 === goals.length)
            toast.success('Todas as metas de hoje feitas!', 'Dia perfeito ✦');
        },
      },
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-4">
        <ProgressRing
          value={done}
          max={goals.length}
          label={`${done} de ${goals.length} metas feitas hoje`}
        >
          <span className="text-sm font-bold tabular-nums">
            {done}/{goals.length}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Metas de hoje</h2>
          <p className="text-sm text-muted">
            {goals.length === 0
              ? 'Nenhuma meta para hoje'
              : done === goals.length
                ? 'Tudo feito. Que dia! ✦'
                : `Faltam ${goals.length - done}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManage(true)}
          aria-label="Gerenciar metas"
          title="Gerenciar metas"
          className="grid size-9 place-items-center rounded-xl text-muted shadow-neu-sm transition-colors hover:text-accent-ink"
        >
          <Settings2 className="size-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl shadow-neu-inset-sm" />
      ) : goals.length === 0 ? (
        <button
          type="button"
          onClick={() => setManage(true)}
          className="flex w-full flex-col items-center gap-2 rounded-2xl px-4 py-6 text-sm text-muted shadow-neu-inset-sm hover:text-accent-ink"
        >
          <Target className="size-5" />
          Criar metas diárias →
        </button>
      ) : (
        <ul className="space-y-2.5">
          {goals.map((g) => {
            const Icon = goalIcon(g.icon);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={g.done}
                  onClick={() => toggle(g.id, g.done)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200',
                    g.done ? 'shadow-neu-inset-sm' : 'shadow-neu-sm hover:-translate-y-px',
                  )}
                >
                  <span
                    className={clsx(
                      'grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300',
                      g.done
                        ? 'kortex-pop bg-accent text-on-accent shadow-glow'
                        : 'text-muted shadow-neu-inset-sm',
                    )}
                  >
                    {g.done ? (
                      <Check className="size-4" strokeWidth={3} />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </span>
                  <span
                    className={clsx(
                      'min-w-0 flex-1 truncate text-sm font-medium',
                      g.done && 'text-muted line-through',
                    )}
                  >
                    {g.title}
                  </span>
                  {g.streak > 0 && (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums"
                      title={`${g.streak} ${g.streak === 1 ? 'vez seguida' : 'vezes seguidas'}`}
                      aria-label={`Sequência: ${g.streak}`}
                    >
                      <Flame
                        className="size-3.5 text-amber"
                        fill="currentColor"
                        style={{ filter: 'drop-shadow(0 0 3px #FFD166)' }}
                      />
                      {g.streak}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <GoalsModal open={manage} onClose={() => setManage(false)} />
    </Card>
  );
}
