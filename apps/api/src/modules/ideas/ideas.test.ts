import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Idea } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';

let app: FastifyInstance;
let close: () => void;

beforeEach(async () => {
  const { db, sqlite } = openDatabase(':memory:');
  runMigrations(db);
  app = await buildApp({ db, logger: false });
  close = () => sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

const create = async (body: object) =>
  (await app.inject({ method: 'POST', url: '/api/ideas', payload: body })).json() as Idea;
const list = async () => (await app.inject('/api/ideas')).json() as Idea[];
const column = async (status: string) =>
  (await list()).filter((i) => i.status === status).map((i) => i.title);

describe('/api/ideas', () => {
  it('cria com defaults e valida título', async () => {
    const idea = await create({ title: '  App de receitas  ' });
    expect(idea).toMatchObject({ title: 'App de receitas', status: 'organized', priority: 2 });
    const bad = await app.inject({ method: 'POST', url: '/api/ideas', payload: { title: '' } });
    expect(bad.statusCode).toBe(400);
  });

  it('novos cards entram no fim da coluna', async () => {
    await create({ title: 'A' });
    await create({ title: 'B' });
    expect(await column('organized')).toEqual(['A', 'B']);
  });

  it('move entre colunas na posição pedida e marca completed_at', async () => {
    const a = await create({ title: 'A' });
    await create({ title: 'X', status: 'done' });
    await create({ title: 'Y', status: 'done' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/ideas/${a.id}/move`,
      payload: { status: 'done', index: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().completedAt).toBeTruthy();
    expect(await column('done')).toEqual(['X', 'A', 'Y']);

    const back = await app.inject({
      method: 'POST',
      url: `/api/ideas/${a.id}/move`,
      payload: { status: 'started', index: 0 },
    });
    expect(back.json().completedAt).toBeNull();
  });

  it('reordena dentro da mesma coluna', async () => {
    await create({ title: 'A' });
    await create({ title: 'B' });
    const c = await create({ title: 'C' });
    await app.inject({
      method: 'POST',
      url: `/api/ideas/${c.id}/move`,
      payload: { status: 'organized', index: 0 },
    });
    expect(await column('organized')).toEqual(['C', 'A', 'B']);
  });

  it('PATCH parcial não reseta outros campos', async () => {
    const a = await create({ title: 'A', status: 'started', priority: 1 });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/ideas/${a.id}`,
      payload: { title: 'A2' },
    });
    expect(res.json()).toMatchObject({ title: 'A2', status: 'started', priority: 1 });
  });

  it('promove a projeto uma única vez', async () => {
    const a = await create({ title: 'SaaS', description: 'detalhes' });
    const res = await app.inject({ method: 'POST', url: `/api/ideas/${a.id}/promote` });
    expect(res.statusCode).toBe(201);
    const { idea, project } = res.json();
    expect(project).toMatchObject({ title: 'SaaS', description: 'detalhes', status: 'idea' });
    expect(idea.promotedProjectId).toBe(project.id);
    const again = await app.inject({ method: 'POST', url: `/api/ideas/${a.id}/promote` });
    expect(again.statusCode).toBe(409);
  });

  it('exclui e retorna 404 para inexistente', async () => {
    const a = await create({ title: 'A' });
    expect((await app.inject({ method: 'DELETE', url: `/api/ideas/${a.id}` })).statusCode).toBe(
      204,
    );
    expect((await app.inject({ method: 'DELETE', url: `/api/ideas/${a.id}` })).statusCode).toBe(
      404,
    );
  });
});
