import { and, asc, eq, max, ne } from 'drizzle-orm';
import type { IdeaMove, IdeaStatus, IdeaUpdate } from '@kortex/shared';
import type { DB } from '../../db/client';
import { ideas, projects } from '../../db/schema';
import { planMove, positionAfter } from '../../lib/ordering';
import { HttpError, notFound } from '../../plugins/error-handler';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
type Conn = DB | Tx;

const nowIso = () => new Date().toISOString();

/** completed_at acompanha a entrada/saída da coluna "done". */
const completedAtFor = (
  from: IdeaStatus,
  to: IdeaStatus,
  current: string | null,
): string | null => {
  if (to === 'done') return from === 'done' ? current : nowIso();
  return null;
};

const endOfColumn = (db: Conn, status: IdeaStatus) =>
  positionAfter(
    db
      .select({ m: max(ideas.position) })
      .from(ideas)
      .where(eq(ideas.status, status))
      .get()?.m,
  );

function getOrThrow(db: Conn, id: number) {
  const row = db.select().from(ideas).where(eq(ideas.id, id)).get();
  if (!row) throw notFound('Ideia');
  return row;
}

export function listIdeas(db: DB) {
  return db.select().from(ideas).orderBy(asc(ideas.status), asc(ideas.position)).all();
}

export function createIdea(
  db: DB,
  input: { title: string; description?: string | null; status: IdeaStatus; priority: number },
) {
  return db
    .insert(ideas)
    .values({
      ...input,
      position: endOfColumn(db, input.status),
      completedAt: input.status === 'done' ? nowIso() : null,
    })
    .returning()
    .get();
}

export function updateIdea(db: DB, id: number, patch: IdeaUpdate) {
  return db.transaction((tx) => {
    const current = getOrThrow(tx, id);
    const changes: Partial<typeof ideas.$inferInsert> = { ...patch };
    if (patch.status && patch.status !== current.status) {
      changes.position = endOfColumn(tx, patch.status);
      changes.completedAt = completedAtFor(current.status, patch.status, current.completedAt);
    }
    return tx.update(ideas).set(changes).where(eq(ideas.id, id)).returning().get();
  });
}

export function moveIdea(db: DB, id: number, { status, index }: IdeaMove) {
  return db.transaction((tx) => {
    const current = getOrThrow(tx, id);
    const siblings = tx
      .select({ id: ideas.id, position: ideas.position })
      .from(ideas)
      .where(and(eq(ideas.status, status), ne(ideas.id, id)))
      .orderBy(asc(ideas.position))
      .all();

    for (const u of planMove(siblings, id, index)) {
      if (u.id !== id)
        tx.update(ideas).set({ position: u.position }).where(eq(ideas.id, u.id)).run();
      else
        tx.update(ideas)
          .set({
            position: u.position,
            status,
            completedAt: completedAtFor(current.status, status, current.completedAt),
          })
          .where(eq(ideas.id, id))
          .run();
    }
    return getOrThrow(tx, id);
  });
}

export function deleteIdea(db: DB, id: number) {
  const res = db.delete(ideas).where(eq(ideas.id, id)).run();
  if (res.changes === 0) throw notFound('Ideia');
}

/** Transforma a ideia em projeto (coluna "Ideias" do Kanban de Projetos). */
export function promoteIdea(db: DB, id: number) {
  return db.transaction((tx) => {
    const idea = getOrThrow(tx, id);
    if (idea.promotedProjectId) throw new HttpError(409, 'Esta ideia já virou projeto');
    const maxPos = tx
      .select({ m: max(projects.position) })
      .from(projects)
      .where(eq(projects.status, 'idea'))
      .get()?.m;
    const project = tx
      .insert(projects)
      .values({
        title: idea.title,
        description: idea.description,
        status: 'idea',
        position: positionAfter(maxPos),
      })
      .returning()
      .get();
    const updated = tx
      .update(ideas)
      .set({ promotedProjectId: project.id })
      .where(eq(ideas.id, id))
      .returning()
      .get();
    return { idea: updated, project };
  });
}
