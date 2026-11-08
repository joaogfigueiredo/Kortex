import { and, asc, eq, isNull, max, ne, type SQL } from 'drizzle-orm';
import type { ProjectCreate, ProjectMove, ProjectStatus, ProjectUpdate } from '@kortex/shared';
import type { DB } from '../../db/client';
import { ideas, projects } from '../../db/schema';
import { planMove, positionAfter } from '../../lib/ordering';
import { HttpError, notFound } from '../../plugins/error-handler';
import { lifecycleDates } from './lifecycle';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
type Conn = DB | Tx;

/** Uma coluna do Kanban = status + nível (só em "development"). */
const columnWhere = (status: ProjectStatus, devLevel: number | null | undefined): SQL =>
  and(
    eq(projects.status, status),
    status === 'development' ? eq(projects.devLevel, devLevel!) : isNull(projects.devLevel),
  )!;

const endOfColumn = (db: Conn, status: ProjectStatus, devLevel?: number | null) =>
  positionAfter(
    db
      .select({ m: max(projects.position) })
      .from(projects)
      .where(columnWhere(status, devLevel))
      .get()?.m,
  );

function getOrThrow(db: Conn, id: number) {
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) throw notFound('Projeto');
  return row;
}

export function listProjects(db: DB) {
  return db
    .select()
    .from(projects)
    .orderBy(asc(projects.status), asc(projects.devLevel), asc(projects.position))
    .all();
}

export function createProject(db: DB, input: ProjectCreate) {
  const status = input.status ?? 'idea';
  const devLevel = status === 'development' ? input.devLevel : null;
  return db
    .insert(projects)
    .values({
      title: input.title,
      description: input.description ?? null,
      repoUrl: input.repoUrl ?? null,
      deployUrl: input.deployUrl ?? null,
      status,
      devLevel,
      position: endOfColumn(db, status, devLevel),
      ...lifecycleDates({ startedAt: null, finishedAt: null, deployedAt: null }, status),
    })
    .returning()
    .get();
}

export function updateProject(db: DB, id: number, patch: ProjectUpdate) {
  return db.transaction((tx) => {
    const current = getOrThrow(tx, id);
    const { status, devLevel, ...fields } = patch;
    const changes: Partial<typeof projects.$inferInsert> = { ...fields };

    if (status !== undefined) {
      const level = status === 'development' ? devLevel : null;
      if (status !== current.status || level !== current.devLevel) {
        Object.assign(changes, {
          status,
          devLevel: level,
          position: endOfColumn(tx, status, level),
          ...lifecycleDates(current, status),
        });
      }
    } else if (devLevel !== undefined && devLevel !== current.devLevel) {
      throw new HttpError(400, 'Para mudar o nível, envie também o status');
    }

    return tx.update(projects).set(changes).where(eq(projects.id, id)).returning().get();
  });
}

export function moveProject(db: DB, id: number, { status, devLevel, index }: ProjectMove) {
  return db.transaction((tx) => {
    const current = getOrThrow(tx, id);
    const level = status === 'development' ? devLevel! : null;
    const siblings = tx
      .select({ id: projects.id, position: projects.position })
      .from(projects)
      .where(and(columnWhere(status, level), ne(projects.id, id)))
      .orderBy(asc(projects.position))
      .all();

    for (const u of planMove(siblings, id, index)) {
      if (u.id !== id) {
        tx.update(projects).set({ position: u.position }).where(eq(projects.id, u.id)).run();
      } else {
        tx.update(projects)
          .set({
            position: u.position,
            status,
            devLevel: level,
            ...lifecycleDates(current, status),
          })
          .where(eq(projects.id, id))
          .run();
      }
    }
    return getOrThrow(tx, id);
  });
}

export function deleteProject(db: DB, id: number) {
  db.transaction((tx) => {
    getOrThrow(tx, id);
    // A ideia de origem volta a poder ser promovida (FK já faz SET NULL; explícito por clareza).
    tx.update(ideas).set({ promotedProjectId: null }).where(eq(ideas.promotedProjectId, id)).run();
    tx.delete(projects).where(eq(projects.id, id)).run();
  });
}
