import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import {
  FINANCE_STATUS,
  IDEA_STATUS,
  PROJECT_STATUS,
  TIME_MODULE,
  type DashboardData,
  type DashboardKpis,
  type DashboardRange,
  type TimeByDay,
} from '@kortex/shared';
import type { DB } from '../../db/client';
import {
  financeActivities,
  financeEntries,
  ideas,
  projects,
  studySubjects,
  timeEntries as te,
} from '../../db/schema';
import { addDays } from '../../lib/calendar';
import { goalsByDay, pctOf, perfectStreak } from '../goals/service';
import { averageDiet, wellnessByDay } from '../health/service';
import { studySummary } from '../studies/service';

export const RANGE_DAYS: Record<DashboardRange, number> = { day: 1, week: 7, month: 30 };

const DAY = sql<string>`substr(${te.startedAt}, 1, 10)`;
/** Fim inclusivo para comparar com timestamps locais "YYYY-MM-DDTHH:mm[:ss]". */
const endOf = (date: string) => `${date}T99`;

const zeroCounts = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/** Segundos por dia e por módulo no intervalo. */
function timeByDay(db: DB, from: string, days: number): TimeByDay[] {
  const to = addDays(from, days - 1);
  const rows = db
    .select({
      day: DAY,
      module: te.module,
      sec: sql<number>`sum(${te.durationSec})`.mapWith(Number),
    })
    .from(te)
    .where(and(gte(te.startedAt, from), lte(te.startedAt, endOf(to))))
    .groupBy(DAY, te.module)
    .all();
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const row = { date, ...zeroCounts(TIME_MODULE) } as TimeByDay;
    for (const r of rows) if (r.day === date) row[r.module] += r.sec;
    return row;
  });
}

const sumTime = (days: TimeByDay[], key?: keyof Omit<TimeByDay, 'date'>) =>
  days.reduce((n, d) => n + (key ? d[key] : TIME_MODULE.reduce((m, k) => m + d[k], 0)), 0);

function kpisFor(db: DB, from: string, days: number): DashboardKpis & { _time: TimeByDay[] } {
  const time = timeByDay(db, from, days);
  const well = wellnessByDay(db, from, days);
  return {
    _time: time,
    focusSec: sumTime(time),
    studySec: sumTime(time, 'study'),
    workouts: well.reduce((n, d) => n + d.workouts, 0),
    workoutMin: well.reduce((n, d) => n + d.workoutMin, 0),
    dietPct: averageDiet(well).dietPct,
    goalsPct: pctOf(goalsByDay(db, from, days)),
  };
}

export function dashboard(db: DB, today: string, range: DashboardRange): DashboardData {
  const days = RANGE_DAYS[range];
  const from = addDays(today, -(days - 1));
  const to = today;
  const toEnd = endOf(to);

  const { _time: time, ...kpis } = kpisFor(db, from, days);
  const { _time: _prevTime, ...prev } = kpisFor(db, addDays(from, -days), days);
  void _prevTime;
  const well = wellnessByDay(db, from, days);

  // Estudo por matéria
  const studyBySubject = db
    .select({
      id: studySubjects.id,
      name: studySubjects.name,
      color: studySubjects.color,
      sec: sql<number>`sum(${te.durationSec})`.mapWith(Number),
    })
    .from(te)
    .innerJoin(studySubjects, eq(studySubjects.id, te.refId))
    .where(and(eq(te.module, 'study'), gte(te.startedAt, from), lte(te.startedAt, toEnd)))
    .groupBy(studySubjects.id)
    .orderBy(sql`sum(${te.durationSec}) desc`)
    .limit(8)
    .all();

  // Projetos: tempo, dias ativos e última atividade no período (continuidade)
  const projectRows = db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      sec: sql<number>`sum(${te.durationSec})`.mapWith(Number),
      activeDays: sql<number>`count(distinct ${DAY})`.mapWith(Number),
      lastAt: sql<string | null>`max(${te.startedAt})`,
    })
    .from(te)
    .innerJoin(projects, eq(projects.id, te.refId))
    .where(and(eq(te.module, 'project'), gte(te.startedAt, from), lte(te.startedAt, toEnd)))
    .groupBy(projects.id)
    .orderBy(sql`sum(${te.durationSec}) desc`)
    .limit(6)
    .all();

  const projectsByStatus = zeroCounts(PROJECT_STATUS);
  for (const r of db
    .select({ s: projects.status, n: count() })
    .from(projects)
    .groupBy(projects.status)
    .all())
    projectsByStatus[r.s] = r.n;

  // Ideias
  const ideasByStatus = zeroCounts(IDEA_STATUS);
  for (const r of db
    .select({ s: ideas.status, n: count() })
    .from(ideas)
    .groupBy(ideas.status)
    .all())
    ideasByStatus[r.s] = r.n;
  // created_at é UTC ISO; para "criadas no período" a precisão de ±1 dia de fuso é aceitável.
  const ideasCreated =
    db
      .select({ n: count() })
      .from(ideas)
      .where(and(gte(ideas.createdAt, from), lte(ideas.createdAt, toEnd)))
      .get()?.n ?? 0;
  const ideasCompleted =
    db
      .select({ n: count() })
      .from(ideas)
      .where(and(gte(ideas.completedAt, from), lte(ideas.completedAt, toEnd)))
      .get()?.n ?? 0;

  // Finanças
  const financeByStatus = zeroCounts(FINANCE_STATUS);
  for (const r of db
    .select({ s: financeActivities.status, n: count() })
    .from(financeActivities)
    .groupBy(financeActivities.status)
    .all())
    financeByStatus[r.s] = r.n;
  const activeIncomeCents =
    db
      .select({
        n: sql<number>`coalesce(sum(${financeActivities.actualMonthlyCents}), 0)`.mapWith(Number),
      })
      .from(financeActivities)
      .where(eq(financeActivities.status, 'active'))
      .get()?.n ?? 0;
  const openAlerts =
    db
      .select({ n: count() })
      .from(financeEntries)
      .where(and(eq(financeEntries.type, 'alert'), eq(financeEntries.resolved, false)))
      .get()?.n ?? 0;

  return {
    range,
    from,
    to,
    kpis,
    prev,
    timeByDay: time,
    studyBySubject,
    projects: projectRows,
    projectsByStatus,
    workoutsByDay: well.map((d) => ({ date: d.date, min: d.workoutMin, count: d.workouts })),
    dietByDay: well.map((d) => ({ date: d.date, pct: d.dietPct, logged: d.mealsLogged > 0 })),
    goalsByDay: goalsByDay(db, from, days),
    streaks: { study: studySummary(db, today).streak, goalsPerfect: perfectStreak(db, today) },
    workDays: time.filter((d) => d.work > 0).length,
    activeDays: time.filter((d) => sumTime([d]) > 0).length,
    ideas: { byStatus: ideasByStatus, created: ideasCreated, completed: ideasCompleted },
    finance: { byStatus: financeByStatus, activeIncomeCents, openAlerts },
  };
}
