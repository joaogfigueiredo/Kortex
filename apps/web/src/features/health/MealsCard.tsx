import clsx from 'clsx';
import { Check, CircleSlash, Settings2, Utensils, X, type LucideIcon } from 'lucide-react';
import type { MealStatus, WellnessDay } from '@kortex/shared';
import { Card, CardHeader } from '../../components/ui';
import { useHealthMutations } from './api';

const STATUS: { value: MealStatus; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'done', label: 'Feita', icon: Check, color: '#4DF5B8' },
  { value: 'partial', label: 'Parcial', icon: CircleSlash, color: '#FFD166' },
  { value: 'skipped', label: 'Pulada', icon: X, color: '#FF6B6B' },
];

export function MealsCard({
  day,
  onEditPlan,
  compact,
  title = 'Refeições',
}: {
  day: WellnessDay | undefined;
  onEditPlan: () => void;
  /** Versão enxuta (Home): sem descrição do prato. */
  compact?: boolean;
  title?: string;
}) {
  const { setMealLog } = useHealthMutations();
  const meals = day?.meals ?? [];
  const done = meals.filter((m) => m.log?.status === 'done').length;

  return (
    <Card>
      <CardHeader
        icon={<Utensils className="size-5" />}
        title={title}
        subtitle={
          meals.length ? `${done} de ${meals.length} feitas` : 'Nenhuma refeição prevista neste dia'
        }
        action={
          <button
            type="button"
            onClick={onEditPlan}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted shadow-neu-sm transition-colors hover:text-accent-ink"
          >
            <Settings2 className="size-3.5" />
            Plano
          </button>
        }
      />
      {meals.length === 0 ? (
        <button
          type="button"
          onClick={onEditPlan}
          className="w-full rounded-2xl px-4 py-8 text-center text-sm text-muted shadow-neu-inset-sm hover:text-accent-ink"
        >
          Monte seu plano de refeições →
        </button>
      ) : (
        <ul className="space-y-3">
          {meals.map((m) => {
            const current = m.log?.status ?? null;
            const color = STATUS.find((s) => s.value === current)?.color;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl bg-bg p-3 shadow-neu-sm"
              >
                <span
                  aria-hidden
                  className={clsx('h-9 w-1 shrink-0 rounded-full', !color && 'bg-line')}
                  style={color ? { background: color, boxShadow: `0 0 8px ${color}` } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      'truncate text-sm font-medium',
                      current === 'skipped' && 'text-muted line-through',
                    )}
                  >
                    {m.name}
                    {m.time && (
                      <span className="ml-2 text-xs font-normal text-muted tabular-nums">
                        {m.time}
                      </span>
                    )}
                  </p>
                  {!compact && m.description && (
                    <p className="truncate text-xs text-muted">{m.description}</p>
                  )}
                </div>
                <div role="group" aria-label={`Marcar ${m.name}`} className="flex shrink-0 gap-1.5">
                  {STATUS.map((s) => {
                    const active = current === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${m.name}: ${s.label}`}
                        title={active ? `${s.label} (clique para limpar)` : s.label}
                        onClick={() =>
                          day &&
                          setMealLog.mutate({
                            mealId: m.id,
                            date: day.date,
                            status: active ? null : s.value,
                          })
                        }
                        className={clsx(
                          'grid size-8 place-items-center rounded-full transition-all duration-200',
                          active ? 'text-on-accent' : 'text-muted shadow-neu-sm hover:text-fg',
                        )}
                        style={
                          active
                            ? { background: s.color, boxShadow: `0 0 10px ${s.color}` }
                            : undefined
                        }
                      >
                        <s.icon className="size-4" strokeWidth={active ? 3 : 2} />
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
