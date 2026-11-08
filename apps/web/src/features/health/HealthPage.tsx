import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Activity, CalendarCheck, ChevronLeft, ChevronRight, Salad, Timer } from 'lucide-react';
import type { WellnessDayStats } from '@kortex/shared';
import { WeekBars } from '../../components/charts/WeekBars';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, IconButton } from '../../components/ui';
import {
  WEEKDAY_SHORT,
  addDaysStr,
  longDayLabel,
  parseDateStr,
  relativeDayLabel,
  todayStr,
} from '../../lib/dates';
import { useWellnessDay, useWellnessSummary } from './api';
import { MealPlanModal } from './MealPlanModal';
import { MealsCard } from './MealsCard';
import { WorkoutsCard } from './WorkoutsCard';

export function HealthPage() {
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [planOpen, setPlanOpen] = useState(false);
  const { data: day, isError } = useWellnessDay(date);
  const { data: summary } = useWellnessSummary();

  return (
    <>
      <PageHeader title="Saúde" subtitle="Treinos e alimentação, um dia de cada vez" />

      {summary && (
        <section
          aria-label="Resumo dos últimos 7 dias"
          className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        >
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
            <Stat
              icon={<Activity className="size-4" />}
              color="#4DF5B8"
              label="Treinos"
              value={String(summary.weekWorkouts)}
              hint={`7 dias · ${summary.weekWorkoutMin} min`}
            />
            <Stat
              icon={<CalendarCheck className="size-4" />}
              color="#6FE3FF"
              label="Dias ativos"
              value={`${summary.activeDays}/7`}
              hint="com pelo menos 1 treino"
            />
            <Stat
              icon={<Salad className="size-4" />}
              color="#B79CFF"
              label="Dieta"
              value={summary.dietPct == null ? '—' : `${summary.dietPct}%`}
              hint={
                summary.loggedDays
                  ? `média de ${summary.loggedDays} ${summary.loggedDays === 1 ? 'dia registrado' : 'dias registrados'}`
                  : 'marque as refeições para ver'
              }
            />
          </div>
          <Card className="p-5">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Timer className="size-4 text-muted" /> Minutos de treino por dia
            </h2>
            <WeekBars
              days={summary.last7.map((d) => ({ date: d.date, value: d.workoutMin }))}
              title="Minutos de treino por dia, últimos 7 dias"
              format={(v) => `${v} min`}
            />
            <h2 className="mt-6 mb-3 text-sm font-semibold">Dieta por dia</h2>
            <DietStrip days={summary.last7} selected={date} onSelect={setDate} />
          </Card>
        </section>
      )}

      {/* Navegação de dia */}
      <div className="mb-6 flex items-center gap-3">
        <IconButton label="Dia anterior" size="sm" onClick={() => setDate(addDaysStr(date, -1))}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <div className="min-w-0 flex-1 text-center sm:flex-none sm:text-left">
          <p className="text-xs font-semibold tracking-wider text-accent-ink uppercase">
            {relativeDayLabel(date, today)}
          </p>
          <p className="truncate text-base font-semibold first-letter:uppercase">
            {longDayLabel(date)}
          </p>
        </div>
        <IconButton
          label="Próximo dia"
          size="sm"
          onClick={() => setDate(addDaysStr(date, 1))}
          disabled={date >= today}
        >
          <ChevronRight className="size-4" />
        </IconButton>
        {date !== today && (
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted shadow-neu-sm hover:text-accent-ink"
          >
            Hoje
          </button>
        )}
      </div>

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar. A API está rodando?
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <MealsCard day={day} onEditPlan={() => setPlanOpen(true)} />
        <WorkoutsCard day={day} />
      </div>

      <MealPlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}

/** Faixa de 7 dias com o % da dieta (número sempre visível; cor é reforço). */
function DietStrip({
  days,
  selected,
  onSelect,
}: {
  days: WellnessDayStats[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const tone = (d: WellnessDayStats) => {
    if (d.dietPct == null || d.mealsLogged === 0) return null;
    return d.dietPct >= 80 ? '#4DF5B8' : d.dietPct >= 50 ? '#FFD166' : '#FF6B6B';
  };
  return (
    <div className="flex gap-2">
      {days.map((d) => {
        const c = tone(d);
        const wd = parseDateStr(d.date).getDay();
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelect(d.date)}
            aria-pressed={selected === d.date}
            aria-label={`${longDayLabel(d.date)}: ${d.dietPct == null ? 'sem plano' : c ? `${d.dietPct}% da dieta` : 'sem registro'}`}
            className={clsx(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all',
              selected === d.date ? 'shadow-neu-inset-sm' : 'hover:shadow-neu-sm',
            )}
            style={
              selected === d.date
                ? { boxShadow: 'var(--shadow-neu-inset-sm), 0 0 0 1.5px var(--k-accent)' }
                : undefined
            }
          >
            <span
              className={clsx('size-2 rounded-full', !c && 'bg-line')}
              style={c ? { background: c, boxShadow: `0 0 6px ${c}` } : undefined}
            />
            <span className="text-xs font-semibold tabular-nums">{c ? `${d.dietPct}%` : '—'}</span>
            <span className="text-[10px] text-muted">{WEEKDAY_SHORT[wd]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stat({
  icon,
  color,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-bg p-4 shadow-neu lg:flex lg:items-center lg:gap-4 lg:px-6">
      <span
        className="mb-2 grid size-8 shrink-0 place-items-center rounded-xl shadow-neu-inset-sm lg:mb-0"
        style={{ color, filter: `drop-shadow(0 0 4px ${color}88)` }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted lg:text-xs">{label}</p>
        <p className="text-base font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-lg lg:text-xl">
          {value}
        </p>
        <p className="hidden truncate text-[11px] text-muted sm:block">{hint}</p>
      </div>
    </div>
  );
}
