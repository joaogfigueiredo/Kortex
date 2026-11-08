import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { TimeEntryCreate, TimeModule } from '@kortex/shared';
import type { DB } from '../../db/client';
import { financeActivities, ideas, projects, studySubjects, timeEntries } from '../../db/schema';
import { HttpError, notFound } from '../../plugins/error-handler';

/** Tabela referenciada por `ref_id` em cada módulo (work/other não têm referência). */
const REF_TABLE = {
  study: studySubjects,
  idea: ideas,
  project: projects,
  finance: financeActivities,
} as const;

function assertRef(db: DB, module: TimeModule, refId: number | null | undefined) {
  if (refId == null) return;
  const table = REF_TABLE[module as keyof typeof REF_TABLE];
  if (!table) throw new HttpError(400, `O módulo "${module}" não aceita referência`);
  if (!db.select({ id: table.id }).from(table).where(eq(table.id, refId)).get())
    throw new HttpError(400, 'Item referenciado não existe');
}

export function createTimeEntry(db: DB, input: TimeEntryCreate) {
  assertRef(db, input.module, input.refId);
  return db
    .insert(timeEntries)
    .values({ ...input, refId: input.refId ?? null, endedAt: input.endedAt ?? null })
    .returning()
    .get();
}

export function listTimeEntries(
  db: DB,
  q: { module?: TimeModule; refId?: number; from?: string; to?: string; limit: number },
) {
  const where: SQL[] = [];
  if (q.module) where.push(eq(timeEntries.module, q.module));
  if (q.refId) where.push(eq(timeEntries.refId, q.refId));
  if (q.from) where.push(gte(timeEntries.startedAt, q.from));
  if (q.to) where.push(lte(timeEntries.startedAt, `${q.to}T99`)); // inclui o dia inteiro
  return db
    .select()
    .from(timeEntries)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(timeEntries.startedAt), desc(timeEntries.id))
    .limit(q.limit)
    .all();
}

export function deleteTimeEntry(db: DB, id: number) {
  const res = db.delete(timeEntries).where(eq(timeEntries.id, id)).run();
  if (res.changes === 0) throw notFound('Sessão');
}
