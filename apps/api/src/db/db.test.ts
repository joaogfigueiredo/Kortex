import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { openDatabase, type DB } from './client';
import { runMigrations } from './migrate';
import { CATEGORY_SEED, seed } from './seed';
import { financeActivities, financeEntries, ideas, projects, reminderCategories } from './schema';
import { buildApp } from '../app';

let db: DB;
let close: () => void;

beforeEach(() => {
  const conn = openDatabase(':memory:');
  db = conn.db;
  close = () => conn.sqlite.close();
  runMigrations(db);
});
afterEach(() => close());

describe('schema', () => {
  it('seed é idempotente', () => {
    seed(db);
    seed(db);
    const n = db.select({ n: count() }).from(reminderCategories).get()!.n;
    expect(n).toBe(CATEGORY_SEED.length);
  });

  it('rejeita status inválido (CHECK)', () => {
    expect(() =>
      db
        .insert(ideas)
        .values({ title: 'x', status: 'banana' as never })
        .run(),
    ).toThrow(/CHECK/);
  });

  it('exige dev_level apenas em "development"', () => {
    expect(() => db.insert(projects).values({ title: 'a', status: 'development' }).run()).toThrow(
      /CHECK/,
    );
    expect(() =>
      db.insert(projects).values({ title: 'b', status: 'idea', devLevel: 2 }).run(),
    ).toThrow(/CHECK/);
    expect(() =>
      db.insert(projects).values({ title: 'c', status: 'development', devLevel: 3 }).run(),
    ).not.toThrow();
  });

  it('apaga histórico em cascata e respeita FKs', () => {
    const act = db.insert(financeActivities).values({ title: 'Canal' }).returning().get();
    db.insert(financeEntries).values({ activityId: act.id, type: 'note', content: 'oi' }).run();
    expect(() =>
      db.insert(financeEntries).values({ activityId: 999, type: 'note', content: 'x' }).run(),
    ).toThrow(/FOREIGN KEY/);
    db.delete(financeActivities).where(eq(financeActivities.id, act.id)).run();
    expect(db.select({ n: count() }).from(financeEntries).get()!.n).toBe(0);
  });
});

describe('api', () => {
  it('GET /api/health', async () => {
    const app = await buildApp({ db, logger: false });
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });

  it('404 em JSON para rotas inexistentes', async () => {
    const app = await buildApp({ db, logger: false });
    const res = await app.inject('/api/nada');
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/não existe/);
    await app.close();
  });
});
