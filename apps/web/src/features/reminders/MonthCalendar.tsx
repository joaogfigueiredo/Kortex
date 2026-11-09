import { useMemo } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Occurrence } from '@kortex/shared';
import { IconButton } from '../../components/ui';
import { WEEKDAY_NAME, WEEKDAY_SHORT, monthGrid, monthLabel, todayStr } from '../../lib/dates';
import { NO_CATEGORY_COLOR } from './OccurrenceItem';

const MAX_DOTS = 4;

export function MonthCalendar({
  year,
  month,
  occurrences,
  selected,
  onSelect,
  onMonthChange,
  weekStart = 0,
}: {
  year: number;
  month: number; // 0..11
  occurrences: Occurrence[];
  selected: string;
  onSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  weekStart?: 0 | 1;
}) {
  const days = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const today = todayStr();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  /** Cores distintas (por categoria) e pendências de cada dia. */
  const byDay = useMemo(() => {
    const map = new Map<string, { colors: string[]; pending: number; total: number }>();
    for (const o of occurrences) {
      const e = map.get(o.date) ?? { colors: [], pending: 0, total: 0 };
      const c = o.color ?? NO_CATEGORY_COLOR;
      if (!e.colors.includes(c)) e.colors.push(c);
      e.total++;
      if (!o.done) e.pending++;
      map.set(o.date, e);
    }
    return map;
  }, [occurrences]);

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };
  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold first-letter:uppercase" data-month-label>
          {monthLabel(year, month)}
        </h2>
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            onMonthChange(now.getFullYear(), now.getMonth());
            onSelect(today);
          }}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted shadow-neu-sm transition-colors hover:text-accent-ink"
        >
          Hoje
        </button>
        <IconButton label="Mês anterior" size="sm" onClick={() => go(-1)}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <IconButton label="Próximo mês" size="sm" onClick={() => go(1)}>
          <ChevronRight className="size-4" />
        </IconButton>
      </div>

      <div aria-label={`Calendário de ${monthLabel(year, month)}`} role="group">
        <div
          aria-hidden
          className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold text-muted uppercase"
        >
          {weekdays.map((w) => (
            <span key={w}>
              <span className="sm:hidden">{WEEKDAY_SHORT[w]}</span>
              <span className="hidden sm:inline">{WEEKDAY_NAME[w]}</span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {days.map((d) => {
            const info = byDay.get(d);
            const inMonth = d.startsWith(monthPrefix);
            const isToday = d === today;
            const isSelected = d === selected;
            const label = new Date(`${d}T12:00`).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            return (
              <button
                key={d}
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${label}${info ? `, ${info.total} ${info.total === 1 ? 'item' : 'itens'}` : ''}`}
                onClick={() => onSelect(d)}
                className={clsx(
                  'relative flex aspect-square flex-col items-center justify-start rounded-xl pt-1.5 text-sm transition-all duration-200 sm:aspect-[1.15] sm:rounded-2xl sm:pt-2.5',
                  isSelected ? 'shadow-neu-inset-sm' : 'hover:shadow-neu-sm',
                  !inMonth && 'text-muted',
                )}
                style={
                  isSelected
                    ? { boxShadow: 'var(--shadow-neu-inset-sm), 0 0 0 2px var(--k-accent)' }
                    : undefined
                }
              >
                <span
                  className={clsx(
                    'grid size-7 place-items-center rounded-full tabular-nums',
                    isToday ? 'bg-accent font-bold text-on-accent shadow-glow' : 'font-medium',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {info && (
                  <span
                    className="mt-auto mb-1.5 flex items-center gap-0.5 sm:mb-2 sm:gap-1"
                    aria-hidden
                  >
                    {info.colors.slice(0, MAX_DOTS).map((c) => (
                      <span
                        key={c}
                        className={clsx(
                          'size-1.5 rounded-full sm:size-2',
                          !info.pending && 'opacity-40',
                        )}
                        style={{
                          background: c,
                          boxShadow: info.pending ? `0 0 6px ${c}` : undefined,
                        }}
                      />
                    ))}
                    {info.colors.length > MAX_DOTS && (
                      <span className="text-[9px] leading-none text-muted">
                        +{info.colors.length - MAX_DOTS}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
