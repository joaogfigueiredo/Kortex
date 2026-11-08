import { and, asc, eq, gte, lte, max } from 'drizzle-orm';
import {
  hasWeekday,
  type DailyGoal,
  type DailyGoalCreate,
  type DailyGoalUpdate,
  type GoalOfDay,
  type GoalsSummary,
} from '@kortex/shared';
import type { DB } from '../../db/client';
import { dailyGoals, goalChecks } from '../../db/schema';
import { addDays, weekdayOf } from '../../lib/calendar';
import { POSITION_STEP } from '../../lib/ordering';
import { HttpError, notFound } from '../../plugins/error-handler';

const STREAK_LOOKBACK = 400;

const appliesOn = (g: Pick<DailyGoal, 'weekdays'>, date: string) =>
  hasWeekday(g.weekdays, weekdayOf(date));

export const listGoals = (db: DB): DailyGoal[] =>
  db.select().from(dailyGoals).orderBy(asc(dailyGoals.position), asc(dailyGoals.id)).all();

export function createGoal(db: DB, input: DailyGoalCreate) {
  const pos =
    (db
      .select({ m: max(dailyGoals.position) })
      .from(dailyGoals)
      .get()?.m ?? 0) + POSITION_STEP;
  return db
    .insert(dailyGoals)
    .values({ ...input, position: pos })
    .returning()
    .get();
}

export function updateGoal(db: DB, id: number, patch: DailyGoalUpdate) {
  const row = db.update(dailyGoals).set(patch).where(eq(dailyGoals.id, id)).returning().get();
  if (!row) throw notFound('Meta');
  return row;
}

export function deleteGoal(db: DB, id: number) {
  if (db.delete(dailyGoals).where(eq(dailyGoals.id, id)).run().changes === 0)
    throw notFound('Meta');
}

export function setGoalCheck(db: DB, id: number, date: string, done: boolean) {
  const goal = db.select().from(dailyGoals).where(eq(dailyGoals.id, id)).get();
  if (!goal) throw notFound('Meta');
  if (!appliesOn(goal, date))
    throw new HttpError(400, 'Esta meta não está prevista para esse dia da semana');
  if (done) {
    db.insert(goalChecks).values({ goalId: id, date }).onConflictDoNothing().run();
  } else {
    db.delete(goalChecks)
      .where(and(eq(goalChecks.goalId, id), eq(goalChecks.date, date)))
      .run();
  }
  return { goalId: id, date, done };
}

/** Conjunto "goalId|date" de checks num intervalo. */
function checksBetween(db: DB, from: string, to: string) {
  return new Set(
    db
      .select()
      .from(goalChecks)
      .where(and(gte(goalChecks.date, from), lte(goalChecks.date, to)))
      .all()
      .map((c) => `${c.goalId}|${c.date}`),
  );
}

/**
 * Sequência de uma meta: conta dias PREVISTOS cumpridos, voltando a partir
 * de `today`. Dias em que a meta não vale são pulados (não quebram).
 * Se hoje está previsto e ainda não foi feito, começa do previsto anterior.
 */
export function goalStreak(
  goal: Pick<DailyGoal, 'id' | 'weekdays'>,
  checks: Set<string>,
  today: string,
) {
  let streak = 0;
  let d = today;
  if (appliesOn(goal, d) && !checks.has(`${goal.id}|${d}`)) d = addDays(d, -1);
  for (let i = 0; i < STREAK_LOOKBACK; i++, d = addDays(d, -1)) {
    if (!appliesOn(goal, d)) continue;
    if (!checks.has(`${goal.id}|${d}`)) break;
    streak++;
  }
  return streak;
}

export function goalsOfDay(db: DB, date: string): GoalOfDay[] {
  const checks = checksBetween(db, addDays(date, -STREAK_LOOKBACK), date);
  return listGoals(db)
    .filter((g) => g.active && appliesOn(g, date))
    .map((g) => ({
      ...g,
      done: checks.has(`${g.id}|${date}`),
      streak: goalStreak(g, checks, date),
    }));
}

export function goalsSummary(db: DB, today: string): GoalsSummary {
  const goals = listGoals(db).filter((g) => g.active);
  const checks = checksBetween(db, addDays(today, -STREAK_LOOKBACK), today);
  const dayStats = (date: string) => {
    const planned = goals.filter((g) => appliesOn(g, date));
    return {
      date,
      planned: planned.length,
      done: planned.filter((g) => checks.has(`${g.id}|${date}`)).length,
    };
  };

  const last7 = Array.from({ length: 7 }, (_, i) => dayStats(addDays(today, i - 6)));
  const planned = last7.reduce((n, d) => n + d.planned, 0);
  const done = last7.reduce((n, d) => n + d.done, 0);

  // Dias "perfeitos" seguidos; dias sem nada previsto não quebram nem contam.
  let perfectStreak = 0;
  let d = today;
  const t = dayStats(d);
  if (t.planned && t.done < t.planned) d = addDays(d, -1);
  for (let i = 0; i < STREAK_LOOKBACK; i++, d = addDays(d, -1)) {
    const s = dayStats(d);
    if (!s.planned) continue;
    if (s.done < s.planned) break;
    perfectStreak++;
  }

  return { last7, weekPct: planned ? Math.round((done / planned) * 100) : null, perfectStreak };
}
