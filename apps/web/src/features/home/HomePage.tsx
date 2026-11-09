import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Flame,
  Salad,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui';
import { NAV } from '../../app/nav';
import { api } from '../../lib/api';
import { addDaysStr, todayStr } from '../../lib/dates';
import { formatDuration } from '../../lib/duration';
import { useGoalsOfDay, useGoalsSummary } from '../goals/api';
import { TodayGoals } from '../goals/TodayGoals';
import { useWellnessDay, useWellnessSummary } from '../health/api';
import { MealsCard } from '../health/MealsCard';
import { useOccurrences } from '../reminders/api';
import { MiniAgenda } from '../reminders/MiniAgenda';
import { useStudySummary } from '../studies/api';

const greeting = (h: number) =>
  h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

export function HomePage() {
  const now = new Date();
  const today = todayStr();
  const navigate = useNavigate();
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: () => api.get<{ status: string }>('/health'),
    refetchInterval: 30_000,
  });
  const { data: goals = [] } = useGoalsOfDay(today);
  const { data: occ = [] } = useOccurrences(today, addDaysStr(today, 1));
  const { data: day } = useWellnessDay(today);

  const todayOcc = occ.filter((o) => o.date === today);
  const pendingToday = todayOcc.filter((o) => !o.done).length;
  const agendaLabel = pendingToday
    ? `${pendingToday} ${pendingToday === 1 ? 'compromisso' : 'compromissos'} hoje`
    : todayOcc.length
      ? 'Agenda em dia ✓'
      : 'Agenda livre hoje';
  const goalsDone = goals.filter((g) => g.done).length;
  const mealsDone = day?.meals.filter((m) => m.log?.status === 'done').length ?? 0;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero com o resumo do dia */}
      <section className="relative overflow-hidden rounded-3xl bg-bg p-6 shadow-neu md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-40 blur-3xl"
          style={{ background: 'var(--k-accent)' }}
        />
        <p className="text-sm text-muted first-letter:uppercase">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          {greeting(now.getHours())} <span className="text-accent-ink">✦</span>
        </h1>
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <Chip
            icon={Target}
            to="#metas"
            label={goals.length ? `${goalsDone}/${goals.length} metas` : 'Sem metas hoje'}
          />
          <Chip icon={CalendarDays} to="/lembretes" label={agendaLabel} />
          {day && day.meals.length > 0 && (
            <Chip icon={Salad} to="/saude" label={`${mealsDone}/${day.meals.length} refeições`} />
          )}
        </div>
        {health.isError && (
          <p
            role="alert"
            className="relative mt-4 inline-flex items-center gap-2 text-sm text-danger"
          >
            <TriangleAlert className="size-4" /> API offline: rode <code>npm run dev</code>
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div id="metas" className="scroll-mt-24">
          <TodayGoals />
        </div>
        <MiniAgenda />
        <div className="md:col-span-2 xl:col-span-1">
          <MealsCard
            day={day}
            compact
            title="Refeições de hoje"
            onEditPlan={() => navigate('/saude')}
          />
        </div>
      </div>

      <WeekSnapshot />

      <nav aria-label="Atalhos">
        <h2 className="mb-4 px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          Módulos
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {NAV.filter((n) => n.to !== '/').map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-2xl bg-bg p-4 text-sm font-medium shadow-neu-sm transition-all hover:-translate-y-0.5 hover:text-accent-ink active:shadow-neu-inset-sm"
            >
              <Icon className="size-5 text-muted transition-colors group-hover:text-accent-ink" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Chip({ icon: Icon, label, to }: { icon: LucideIcon; label: string; to: string }) {
  const cls =
    'inline-flex items-center gap-2 rounded-full bg-bg/70 px-3.5 py-2 text-xs font-medium shadow-neu-sm backdrop-blur transition-colors hover:text-accent-ink';
  const content = (
    <>
      <Icon className="size-3.5 text-accent-ink" />
      {label}
    </>
  );
  return to.startsWith('#') ? (
    <a href={to} className={cls}>
      {content}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {content}
    </Link>
  );
}

/** Retrato dos últimos 7 dias (números; os gráficos completos ficam no Dashboard). */
function WeekSnapshot() {
  const { data: study } = useStudySummary();
  const { data: wellness } = useWellnessSummary();
  const { data: goals } = useGoalsSummary();

  return (
    <Card>
      <CardHeader
        icon={<Flame className="size-5" />}
        title="Sua semana"
        subtitle="Últimos 7 dias"
        action={
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
          >
            Dashboard <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Snap
          icon={<Target className="size-4" />}
          color="#6FE3FF"
          label="Metas cumpridas"
          value={goals?.weekPct == null ? '—' : `${goals.weekPct}%`}
          hint={
            goals?.perfectStreak
              ? `${goals.perfectStreak} ${goals.perfectStreak === 1 ? 'dia perfeito' : 'dias perfeitos'} seguidos`
              : 'nenhum dia perfeito seguido'
          }
        />
        <Snap
          icon={<BookOpen className="size-4" />}
          color="#FFD166"
          label="Estudo"
          value={study ? formatDuration(study.weekSec) : '—'}
          hint={
            study?.streak
              ? `${study.streak} ${study.streak === 1 ? 'dia' : 'dias'} seguidos`
              : 'sem sequência'
          }
        />
        <Snap
          icon={<Dumbbell className="size-4" />}
          color="#4DF5B8"
          label="Treinos"
          value={wellness ? String(wellness.weekWorkouts) : '—'}
          hint={wellness ? `${wellness.weekWorkoutMin} min · ${wellness.activeDays}/7 dias` : ''}
        />
        <Snap
          icon={<Salad className="size-4" />}
          color="#B79CFF"
          label="Dieta"
          value={wellness?.dietPct == null ? '—' : `${wellness.dietPct}%`}
          hint={wellness?.loggedDays ? `${wellness.loggedDays} dias registrados` : 'sem registros'}
        />
      </dl>
    </Card>
  );
}

function Snap({
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
    <div className="rounded-2xl p-4 shadow-neu-inset-sm">
      <dt className="flex items-center gap-2 text-xs text-muted">
        <span style={{ color, filter: `drop-shadow(0 0 4px ${color}88)` }}>{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 text-xl font-bold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-0.5 truncate text-[11px] text-muted">{hint}</dd>
    </div>
  );
}
