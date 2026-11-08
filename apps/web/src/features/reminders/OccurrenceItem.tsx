import clsx from 'clsx';
import { BellRing, CalendarClock, Check, Megaphone, Repeat, type LucideIcon } from 'lucide-react';
import { REMINDER_KIND_LABEL, type Occurrence, type ReminderKind } from '@kortex/shared';

export const KIND_ICON: Record<ReminderKind, LucideIcon> = {
  reminder: BellRing,
  appointment: CalendarClock,
  notice: Megaphone,
};

export const NO_CATEGORY_COLOR = '#9AA3B2';

export function OccurrenceItem({
  occ,
  onToggle,
  onOpen,
  compact,
}: {
  occ: Occurrence;
  onToggle: () => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  const color = occ.color ?? NO_CATEGORY_COLOR;
  const Icon = KIND_ICON[occ.kind];
  return (
    <li
      className={clsx(
        'group flex items-center gap-3 rounded-2xl bg-bg transition-all',
        compact ? 'px-3 py-2.5 shadow-neu-inset-sm' : 'p-3 shadow-neu-sm',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={occ.done}
        aria-label={occ.done ? `Desmarcar "${occ.title}"` : `Concluir "${occ.title}"`}
        onClick={onToggle}
        className={clsx(
          'grid size-7 shrink-0 place-items-center rounded-full transition-all duration-200',
          occ.done
            ? 'text-on-accent'
            : 'shadow-neu-inset-sm hover:shadow-[inset_0_0_0_2px_var(--k-accent)]',
        )}
        style={occ.done ? { background: color, boxShadow: `0 0 10px ${color}` } : undefined}
      >
        {occ.done && <Check className="size-4" strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="min-w-0 flex-1">
          <span
            className={clsx(
              'block truncate text-sm font-medium',
              occ.done && 'text-muted line-through',
            )}
          >
            {occ.title}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <Icon className="size-3" aria-hidden />
            {REMINDER_KIND_LABEL[occ.kind]}
            {occ.recurrence !== 'none' && <Repeat className="size-3" aria-label="Repete" />}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs font-medium text-muted tabular-nums">
          {occ.allDay ? 'Dia todo' : occ.time}
          {occ.endTime && <span className="block text-[10px] font-normal">até {occ.endTime}</span>}
        </span>
      </button>
    </li>
  );
}
