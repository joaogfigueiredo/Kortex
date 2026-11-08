import { and, asc, desc, eq, max, ne, sql } from 'drizzle-orm';
import type {
  FinanceActivityCreate,
  FinanceActivityUpdate,
  FinanceEntryCreate,
  FinanceEntryUpdate,
  FinanceMove,
  FinanceStatus,
} from '@kortex/shared';
import type { DB } from '../../db/client';
import { financeActivities as fa, financeEntries as fe, projects } from '../../db/schema';
import { planMove, positionAfter } from '../../lib/ordering';
import { HttpError, notFound } from '../../plugins/error-handler';
import { describeChanges, statusSummary } from './history';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
type Conn = DB | Tx;

/**
 * Referência QUALIFICADA à atividade dentro das subqueries correlacionadas.
 * (`${fa.id}` vira só "id", que o SQLite resolveria como finance_entries.id.)
 */
const ACTIVITY_ID = sql.raw('"finance_activities"."id"');

/** Colunas da atividade + estatísticas de avisos pendentes (para o card). */
const withStats = {
  id: fa.id,
  title: fa.title,
  description: fa.description,
  status: fa.status,
  kind: fa.kind,
  expectedMonthlyCents: fa.expectedMonthlyCents,
  actualMonthlyCents: fa.actualMonthlyCents,
  currency: fa.currency,
  position: fa.position,
  projectId: fa.projectId,
  createdAt: fa.createdAt,
  updatedAt: fa.updatedAt,
  openAlerts: sql<number>`(select count(*) from finance_entries e
    where e.activity_id = ${ACTIVITY_ID} and e.type = 'alert' and e.resolved = 0)`.mapWith(Number),
  nextDueAt: sql<string | null>`(select min(e.due_at) from finance_entries e
    where e.activity_id = ${ACTIVITY_ID} and e.type = 'alert' and e.resolved = 0 and e.due_at is not null)`,
};

const endOfColumn = (db: Conn, status: FinanceStatus) =>
  positionAfter(
    db
      .select({ m: max(fa.position) })
      .from(fa)
      .where(eq(fa.status, status))
      .get()?.m,
  );

function getRaw(db: Conn, id: number) {
  const row = db.select().from(fa).where(eq(fa.id, id)).get();
  if (!row) throw notFound('Atividade');
  return row;
}

const getWithStats = (db: Conn, id: number) =>
  db.select(withStats).from(fa).where(eq(fa.id, id)).get()!;

function assertProject(db: Conn, projectId: number | null | undefined) {
  if (projectId == null) return;
  if (!db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get())
    throw new HttpError(400, 'Projeto vinculado não existe');
}

const logEntry = (db: Conn, values: typeof fe.$inferInsert) => db.insert(fe).values(values).run();

export const listActivities = (db: DB) =>
  db.select(withStats).from(fa).orderBy(asc(fa.status), asc(fa.position)).all();

export function createActivity(db: DB, input: FinanceActivityCreate) {
  return db.transaction((tx) => {
    assertProject(tx, input.projectId);
    const row = tx
      .insert(fa)
      .values({ ...input, position: endOfColumn(tx, input.status) })
      .returning()
      .get();
    logEntry(tx, { activityId: row.id, type: 'edit', content: 'Atividade criada' });
    return getWithStats(tx, row.id);
  });
}

export function updateActivity(db: DB, id: number, patch: FinanceActivityUpdate) {
  return db.transaction((tx) => {
    const current = getRaw(tx, id);
    assertProject(tx, patch.projectId);
    const { status, ...fields } = patch;
    const changes: Partial<typeof fa.$inferInsert> = { ...fields };

    const diff = describeChanges(current, fields, {
      projectTitle: (pid) =>
        tx.select({ t: projects.title }).from(projects).where(eq(projects.id, pid)).get()?.t,
    });
    if (diff) {
      logEntry(tx, {
        activityId: id,
        type: 'edit',
        content: diff.summary,
        meta: { changes: diff.changes },
      });
    }
    if (status && status !== current.status) {
      changes.status = status;
      changes.position = endOfColumn(tx, status);
      logEntry(tx, {
        activityId: id,
        type: 'status_change',
        content: statusSummary(current.status, status),
        meta: { from: current.status, to: status },
      });
    }
    if (Object.keys(changes).length) tx.update(fa).set(changes).where(eq(fa.id, id)).run();
    return getWithStats(tx, id);
  });
}

export function moveActivity(db: DB, id: number, { status, index }: FinanceMove) {
  return db.transaction((tx) => {
    const current = getRaw(tx, id);
    const siblings = tx
      .select({ id: fa.id, position: fa.position })
      .from(fa)
      .where(and(eq(fa.status, status), ne(fa.id, id)))
      .orderBy(asc(fa.position))
      .all();
    for (const u of planMove(siblings, id, index)) {
      tx.update(fa)
        .set(u.id === id ? { position: u.position, status } : { position: u.position })
        .where(eq(fa.id, u.id))
        .run();
    }
    if (status !== current.status) {
      logEntry(tx, {
        activityId: id,
        type: 'status_change',
        content: statusSummary(current.status, status),
        meta: { from: current.status, to: status },
      });
    }
    return getWithStats(tx, id);
  });
}

export function deleteActivity(db: DB, id: number) {
  const res = db.delete(fa).where(eq(fa.id, id)).run();
  if (res.changes === 0) throw notFound('Atividade');
}

// ---------- Histórico / observações / avisos ----------

export function listEntries(db: DB, activityId: number) {
  getRaw(db, activityId);
  return db
    .select()
    .from(fe)
    .where(eq(fe.activityId, activityId))
    .orderBy(desc(fe.createdAt), desc(fe.id))
    .all();
}

export function createEntry(db: DB, activityId: number, input: FinanceEntryCreate) {
  getRaw(db, activityId);
  return db
    .insert(fe)
    .values({ activityId, type: input.type, content: input.content, dueAt: input.dueAt ?? null })
    .returning()
    .get();
}

/** Só observações e avisos são editáveis; edições/status são histórico imutável. */
function getEditableEntry(db: Conn, entryId: number) {
  const entry = db.select().from(fe).where(eq(fe.id, entryId)).get();
  if (!entry) throw notFound('Registro');
  if (entry.type !== 'note' && entry.type !== 'alert')
    throw new HttpError(403, 'Registros automáticos do histórico não podem ser alterados');
  return entry;
}

export function updateEntry(db: DB, entryId: number, patch: FinanceEntryUpdate) {
  const entry = getEditableEntry(db, entryId);
  if (entry.type === 'note' && (patch.dueAt !== undefined || patch.resolved !== undefined))
    throw new HttpError(400, 'Observações não têm data nem status de resolvido');
  return db.update(fe).set(patch).where(eq(fe.id, entryId)).returning().get();
}

export function deleteEntry(db: DB, entryId: number) {
  getEditableEntry(db, entryId);
  db.delete(fe).where(eq(fe.id, entryId)).run();
}
