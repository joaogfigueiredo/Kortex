import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { StudySubjectCreate, StudySubjectUpdate, StudySummary } from '@kortex/shared';
import type { DB } from '../../db/client';
import { studySubjects as ss, timeEntries as te } from '../../db/schema';
import { addDays } from '../../lib/calendar';
import { notFound } from '../../plugins/error-handler';

/** Subquery correlacionada precisa da referência qualificada (ver finance/service). */
const SUBJECT_ID = sql.raw('"study_subjects"."id"');
const sessionsOf = sql`from time_entries t where t.module = 'study' and t.ref_id = ${SUBJECT_ID}`;

/** Colunas + estatísticas das sessões. `weekFrom` = primeiro dia da janela de 7 dias. */
const withStats = (weekFrom: string) => ({
  id: ss.id,
  name: ss.name,
  description: ss.description,
  color: ss.color,
  level: ss.level,
  progress: ss.progress,
  targetHours: ss.targetHours,
  archived: ss.archived,
  createdAt: ss.createdAt,
  updatedAt: ss.updatedAt,
  totalSec: sql<number>`(select coalesce(sum(t.duration_sec), 0) ${sessionsOf})`.mapWith(Number),
  weekSec:
    sql<number>`(select coalesce(sum(t.duration_sec), 0) ${sessionsOf} and t.started_at >= ${weekFrom})`.mapWith(
      Number,
    ),
  sessions: sql<number>`(select count(*) ${sessionsOf})`.mapWith(Number),
  lastStudiedAt: sql<string | null>`(select max(t.started_at) ${sessionsOf})`,
});

const getWithStats = (db: DB, id: number, today: string) => {
  const row = db
    .select(withStats(addDays(today, -6)))
    .from(ss)
    .where(eq(ss.id, id))
    .get();
  if (!row) throw notFound('Matéria');
  return row;
};

export const listSubjects = (db: DB, today: string) =>
  db
    .select(withStats(addDays(today, -6)))
    .from(ss)
    .orderBy(asc(ss.archived), asc(ss.name))
    .all();

export function createSubject(db: DB, input: StudySubjectCreate, today: string) {
  const row = db.insert(ss).values(input).returning().get();
  return getWithStats(db, row.id, today);
}

export function updateSubject(db: DB, id: number, patch: StudySubjectUpdate, today: string) {
  const res = db.update(ss).set(patch).where(eq(ss.id, id)).run();
  if (res.changes === 0) throw notFound('Matéria');
  return getWithStats(db, id, today);
}

/** Exclui a matéria e as sessões dela (time_entries é polimórfica, sem FK). */
export function deleteSubject(db: DB, id: number) {
  db.transaction((tx) => {
    const res = tx.delete(ss).where(eq(ss.id, id)).run();
    if (res.changes === 0) throw notFound('Matéria');
    tx.delete(te)
      .where(and(eq(te.module, 'study'), eq(te.refId, id)))
      .run();
  });
}

/** Tempo da semana, dias por dia e sequência (streak) até hoje/ontem. */
export function studySummary(db: DB, today: string): StudySummary {
  const from = addDays(today, -365);
  const rows = db
    .select({
      day: sql<string>`substr(${te.startedAt}, 1, 10)`,
      sec: sql<number>`sum(${te.durationSec})`.mapWith(Number),
    })
    .from(te)
    .where(and(eq(te.module, 'study'), gte(te.startedAt, from)))
    .groupBy(sql`substr(${te.startedAt}, 1, 10)`)
    .all();
  const byDay = new Map(rows.map((r) => [r.day, r.sec]));

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, sec: byDay.get(date) ?? 0 };
  });

  // Sequência: conta para trás a partir de hoje (ou de ontem, se hoje ainda não estudou).
  let cursor = byDay.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (byDay.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return { weekSec: last7.reduce((n, d) => n + d.sec, 0), streak, last7 };
}
