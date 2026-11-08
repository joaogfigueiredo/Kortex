import { and, asc, desc, eq, gte, lte, max, sql, type SQL } from 'drizzle-orm';
import {
  hasWeekday,
  type Meal,
  type MealPlanCreate,
  type MealPlanUpdate,
  type MealStatus,
  type WellnessDay,
  type WellnessDayStats,
  type WellnessSummary,
  type WorkoutCreate,
  type WorkoutUpdate,
} from '@kortex/shared';
import type { DB } from '../../db/client';
import { mealLogs, mealPlan, workouts } from '../../db/schema';
import { addDays, weekdayOf } from '../../lib/calendar';
import { POSITION_STEP } from '../../lib/ordering';
import { HttpError, notFound } from '../../plugins/error-handler';

// ---------- Treinos ----------

export function listWorkouts(db: DB, q: { from?: string; to?: string; limit: number }) {
  const where: SQL[] = [];
  if (q.from) where.push(gte(workouts.date, q.from));
  if (q.to) where.push(lte(workouts.date, q.to));
  return db
    .select()
    .from(workouts)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(q.limit)
    .all();
}

/** Tipos já usados, do mais frequente para o menos (para os atalhos do formulário). */
export const workoutTypes = (db: DB) =>
  db
    .select({ type: workouts.type, n: sql<number>`count(*)`.mapWith(Number) })
    .from(workouts)
    .groupBy(workouts.type)
    .orderBy(desc(sql`count(*)`), asc(workouts.type))
    .limit(12)
    .all()
    .map((r) => r.type);

export const createWorkout = (db: DB, input: WorkoutCreate) =>
  db.insert(workouts).values(input).returning().get();

export function updateWorkout(db: DB, id: number, patch: WorkoutUpdate) {
  const row = db.update(workouts).set(patch).where(eq(workouts.id, id)).returning().get();
  if (!row) throw notFound('Treino');
  return row;
}

export function deleteWorkout(db: DB, id: number) {
  if (db.delete(workouts).where(eq(workouts.id, id)).run().changes === 0) throw notFound('Treino');
}

// ---------- Plano de refeições ----------

export const listMeals = (db: DB): Meal[] =>
  db.select().from(mealPlan).orderBy(asc(mealPlan.time), asc(mealPlan.position)).all();

export function createMeal(db: DB, input: MealPlanCreate) {
  const pos =
    (db
      .select({ m: max(mealPlan.position) })
      .from(mealPlan)
      .get()?.m ?? 0) + POSITION_STEP;
  return db
    .insert(mealPlan)
    .values({ ...input, position: pos })
    .returning()
    .get();
}

export function updateMeal(db: DB, id: number, patch: MealPlanUpdate) {
  const row = db.update(mealPlan).set(patch).where(eq(mealPlan.id, id)).returning().get();
  if (!row) throw notFound('Refeição');
  return row;
}

/** Exclui a refeição do plano e suas marcações (FK em cascata). */
export function deleteMeal(db: DB, id: number) {
  if (db.delete(mealPlan).where(eq(mealPlan.id, id)).run().changes === 0)
    throw notFound('Refeição');
}

/** Refeições ativas previstas para o dia da semana de `date`. */
const mealsForDate = (all: Meal[], date: string) =>
  all.filter((m) => m.active && hasWeekday(m.weekdays, weekdayOf(date)));

export function setMealLog(
  db: DB,
  mealId: number,
  date: string,
  status: MealStatus,
  note?: string | null,
) {
  const meal = db.select().from(mealPlan).where(eq(mealPlan.id, mealId)).get();
  if (!meal) throw notFound('Refeição');
  if (!hasWeekday(meal.weekdays, weekdayOf(date)))
    throw new HttpError(400, 'Esta refeição não está prevista para esse dia da semana');
  return db
    .insert(mealLogs)
    .values({ mealId, date, status, note: note ?? null })
    .onConflictDoUpdate({
      target: [mealLogs.mealId, mealLogs.date],
      set: { status, note: note ?? null },
    })
    .returning()
    .get();
}

export function clearMealLog(db: DB, mealId: number, date: string) {
  db.delete(mealLogs)
    .where(and(eq(mealLogs.mealId, mealId), eq(mealLogs.date, date)))
    .run();
}

// ---------- Visões combinadas ----------

export function wellnessDay(db: DB, date: string): WellnessDay {
  const logs = new Map(
    db
      .select()
      .from(mealLogs)
      .where(eq(mealLogs.date, date))
      .all()
      .map((l) => [l.mealId, l]),
  );
  return {
    date,
    meals: mealsForDate(listMeals(db), date).map((m) => ({ ...m, log: logs.get(m.id) ?? null })),
    workouts: listWorkouts(db, { from: date, to: date, limit: 50 }),
  };
}

/** Aderência: feita = 1, parcial = 0,5, pulada/sem marcação = 0. */
export const dietPct = (planned: number, done: number, partial: number) =>
  planned ? Math.round(((done + partial * 0.5) / planned) * 100) : null;

export function wellnessSummary(db: DB, today: string): WellnessSummary {
  const from = addDays(today, -6);
  const meals = listMeals(db);
  const logs = db
    .select()
    .from(mealLogs)
    .where(and(gte(mealLogs.date, from), lte(mealLogs.date, today)))
    .all();
  const wk = listWorkouts(db, { from, to: today, limit: 500 });

  const last7: WellnessDayStats[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    const planned = mealsForDate(meals, date);
    const ids = new Set(planned.map((m) => m.id));
    const dayLogs = logs.filter((l) => l.date === date && ids.has(l.mealId));
    const done = dayLogs.filter((l) => l.status === 'done').length;
    const partial = dayLogs.filter((l) => l.status === 'partial').length;
    const dayWk = wk.filter((w) => w.date === date);
    return {
      date,
      workoutMin: dayWk.reduce((n, w) => n + (w.durationMin ?? 0), 0),
      workouts: dayWk.length,
      mealsPlanned: planned.length,
      mealsDone: done,
      mealsPartial: partial,
      mealsLogged: dayLogs.length,
      dietPct: dietPct(planned.length, done, partial),
    };
  });

  // Média só dos dias com plano E alguma marcação: dias sem registro não viram "0%".
  const logged = last7.filter((d) => d.dietPct != null && d.mealsLogged > 0);
  return {
    last7,
    weekWorkouts: wk.length,
    weekWorkoutMin: last7.reduce((n, d) => n + d.workoutMin, 0),
    activeDays: last7.filter((d) => d.workouts > 0).length,
    loggedDays: logged.length,
    dietPct: logged.length
      ? Math.round(logged.reduce((n, d) => n + d.dietPct!, 0) / logged.length)
      : null,
  };
}
