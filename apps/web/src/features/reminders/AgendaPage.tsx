import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarCheck, Plus } from 'lucide-react';
import type { Occurrence } from '@kortex/shared';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card } from '../../components/ui';
import { addDaysStr, longDayLabel, monthGrid, relativeDayLabel, todayStr } from '../../lib/dates';
import { useCategories, useOccurrences, useReminderMutations } from './api';
import { MonthCalendar } from './MonthCalendar';
import { NO_CATEGORY_COLOR, OccurrenceItem } from './OccurrenceItem';
import { ReminderModal, type ReminderModalState } from './ReminderModal';

const UPCOMING_DAYS = 7;

export function AgendaPage() {
  const today = todayStr();
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [hidden, setHidden] = useState<Set<number | 'none'>>(new Set());
  const [modal, setModal] = useState<ReminderModalState>({ mode: 'closed' });

  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);
  // Busca a grade do mês + os próximos 7 dias a partir de hoje (para "Próximos").
  const from = [grid[0]!, today].sort()[0]!;
  const to = [grid.at(-1)!, addDaysStr(today, UPCOMING_DAYS)].sort().at(-1)!;
  const { data: occurrences = [], isError } = useOccurrences(from, to);
  const { data: categories = [] } = useCategories();
  const { toggle } = useReminderMutations();

  const visible = occurrences.filter((o) => !hidden.has(o.categoryId ?? 'none'));
  const dayItems = visible.filter((o) => o.date === selected);
  const upcoming = visible.filter(
    (o) => o.date > selected && o.date <= addDaysStr(today, UPCOMING_DAYS) && !o.done,
  );

  const onToggle = (o: Occurrence) =>
    toggle.mutate({ reminderId: o.reminderId, date: o.date, done: !o.done });
  const open = (o: Occurrence) => setModal({ mode: 'edit', reminderId: o.reminderId });
  const filterChips = [
    ...categories.map((c) => ({ key: c.id as number | 'none', name: c.name, color: c.color })),
    { key: 'none' as const, name: 'Sem categoria', color: NO_CATEGORY_COLOR },
  ];

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Lembretes, compromissos e avisos"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', date: selected })}
          >
            Novo
          </Button>
        }
      />

      {/* Legenda/filtro por categoria */}
      <div
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0"
        aria-label="Filtrar categorias"
      >
        {filterChips.map((c) => {
          const off = hidden.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (off) n.delete(c.key);
                  else n.add(c.key);
                  return n;
                })
              }
              className={clsx(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-neu-sm transition-all',
                off && 'opacity-45 shadow-neu-inset-sm',
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: c.color, boxShadow: off ? undefined : `0 0 6px ${c.color}` }}
              />
              {c.name}
            </button>
          );
        })}
      </div>

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar a agenda. A API está rodando?
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-4 sm:p-6">
          <MonthCalendar
            year={view.year}
            month={view.month}
            occurrences={visible}
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              const [y, m] = d.split('-').map(Number) as [number, number];
              if (y !== view.year || m - 1 !== view.month) setView({ year: y, month: m - 1 });
            }}
            onMonthChange={(year, month) => setView({ year, month })}
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wider text-accent-ink uppercase">
                  {relativeDayLabel(selected, today)}
                </p>
                <h2 className="mt-0.5 text-base font-semibold first-letter:uppercase">
                  {longDayLabel(selected)}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Adicionar neste dia"
                title="Adicionar neste dia"
                onClick={() => setModal({ mode: 'create', date: selected })}
                className="grid size-9 place-items-center rounded-xl text-muted shadow-neu-sm transition-colors hover:text-accent-ink"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {dayItems.length ? (
              <ul className="space-y-3">
                {dayItems.map((o) => (
                  <OccurrenceItem
                    key={`${o.reminderId}-${o.date}`}
                    occ={o}
                    onToggle={() => onToggle(o)}
                    onOpen={() => open(o)}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl px-4 py-8 text-center shadow-neu-inset-sm">
                <CalendarCheck className="size-6 text-muted" />
                <p className="text-sm text-muted">Nada marcado para este dia.</p>
              </div>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted uppercase">
                Próximos dias
              </h2>
              <ul className="space-y-2.5">
                {upcoming.slice(0, 8).map((o) => (
                  <li key={`${o.reminderId}-${o.date}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(o.date)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:text-accent-ink"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: o.color ?? NO_CATEGORY_COLOR,
                          boxShadow: `0 0 6px ${o.color ?? NO_CATEGORY_COLOR}`,
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{o.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {relativeDayLabel(o.date, today)}
                        {o.time && ` · ${o.time}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <ReminderModal state={modal} onClose={() => setModal({ mode: 'closed' })} />
    </>
  );
}
