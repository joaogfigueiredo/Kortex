import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, Plus } from 'lucide-react';
import type { Occurrence } from '@kortex/shared';
import { Card, CardHeader } from '../../components/ui';
import { addDaysStr, relativeDayLabel, todayStr } from '../../lib/dates';
import { useOccurrences, useReminderMutations } from './api';
import { OccurrenceItem } from './OccurrenceItem';
import { ReminderModal, type ReminderModalState } from './ReminderModal';

const DAYS = 2;
const MAX_PER_DAY = 3;

/** Mini-agenda da Home: hoje + amanhã, com check rápido. */
export function MiniAgenda() {
  const today = todayStr();
  const { data = [], isLoading } = useOccurrences(today, addDaysStr(today, DAYS - 1));
  const { toggle } = useReminderMutations();
  const [modal, setModal] = useState<ReminderModalState>({ mode: 'closed' });

  const days = Array.from({ length: DAYS }, (_, i) => addDaysStr(today, i))
    .map((d) => ({ date: d, items: data.filter((o) => o.date === d) }))
    .filter((d) => d.date === today || d.items.length);
  const pendingToday = data.filter((o) => o.date === today && !o.done).length;

  const onToggle = (o: Occurrence) =>
    toggle.mutate({ reminderId: o.reminderId, date: o.date, done: !o.done });

  return (
    <Card>
      <CardHeader
        icon={<CalendarDays className="size-5" />}
        title="Agenda"
        subtitle={
          pendingToday
            ? `${pendingToday} pendente${pendingToday > 1 ? 's' : ''} hoje`
            : 'Tudo em dia hoje ✦'
        }
        action={
          <button
            type="button"
            aria-label="Novo lembrete para hoje"
            title="Novo lembrete"
            onClick={() => setModal({ mode: 'create', date: today })}
            className="grid size-9 place-items-center rounded-xl text-muted shadow-neu-sm transition-colors hover:text-accent-ink"
          >
            <Plus className="size-4" />
          </button>
        }
      />
      {isLoading ? (
        <div className="h-28 animate-pulse rounded-2xl shadow-neu-inset-sm" />
      ) : (
        <div className="space-y-4">
          {days.map((d) => (
            <section key={d.date} aria-label={relativeDayLabel(d.date, today)}>
              <h4 className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
                {relativeDayLabel(d.date, today)}
              </h4>
              {d.items.length ? (
                <ul className="space-y-2">
                  {d.items.slice(0, MAX_PER_DAY).map((o) => (
                    <OccurrenceItem
                      key={`${o.reminderId}-${o.date}`}
                      occ={o}
                      compact
                      onToggle={() => onToggle(o)}
                      onOpen={() => setModal({ mode: 'edit', reminderId: o.reminderId })}
                    />
                  ))}
                  {d.items.length > MAX_PER_DAY && (
                    <li className="px-1 text-xs text-muted">
                      +{d.items.length - MAX_PER_DAY} na agenda
                    </li>
                  )}
                </ul>
              ) : (
                <p className="rounded-2xl px-3 py-3 text-sm text-muted shadow-neu-inset-sm">
                  Nada marcado para hoje.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
      <Link
        to="/lembretes"
        className="mt-4 inline-flex items-center gap-1.5 px-1 text-xs font-medium text-accent-ink hover:underline"
      >
        Abrir agenda completa <ArrowRight className="size-3.5" />
      </Link>
      <ReminderModal state={modal} onClose={() => setModal({ mode: 'closed' })} />
    </Card>
  );
}
