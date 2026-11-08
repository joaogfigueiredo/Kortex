import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Idea, Project } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';
import { lifecycleDates } from './lifecycle';

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

const req = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api/projects' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const create = async (body: object) => (await req('POST', '', body)).body as Project;
const move = (id: number, body: object) => req('POST', `/${id}/move`, body);

describe('lifecycleDates', () => {
  const empty = { startedAt: null, finishedAt: null, deployedAt: null };
  it('avança preenchendo e preserva datas existentes', () => {
    expect(lifecycleDates(empty, 'idea', 'T')).toEqual(empty);
    expect(lifecycleDates(empty, 'development', 'T')).toEqual({ ...empty, startedAt: 'T' });
    expect(lifecycleDates(empty, 'deployed', 'T')).toEqual({
      startedAt: 'T',
      finishedAt: 'T',
      deployedAt: 'T',
    });
    const started = { ...empty, startedAt: 'A' };
    expect(lifecycleDates(started, 'done', 'T')).toEqual({
      ...empty,
      startedAt: 'A',
      finishedAt: 'T',
    });
  });
  it('voltar limpa as datas das fases seguintes', () => {
    const all = { startedAt: 'A', finishedAt: 'B', deployedAt: 'C' };
    expect(lifecycleDates(all, 'done', 'T')).toEqual({ ...all, deployedAt: null });
    expect(lifecycleDates(all, 'idea', 'T')).toEqual({
      startedAt: null,
      finishedAt: null,
      deployedAt: null,
    });
  });
});

describe('/api/projects', () => {
  it('cria com defaults; URL vazia vira null; URL inválida é rejeitada', async () => {
    const p = await create({ title: 'Kortex', repoUrl: '', deployUrl: 'https://kortex.app' });
    expect(p).toMatchObject({
      status: 'idea',
      devLevel: null,
      repoUrl: null,
      deployUrl: 'https://kortex.app',
    });
    expect((await req('POST', '', { title: 'x', repoUrl: 'github.com/x' })).status).toBe(400);
  });

  it('exige nível só em development', async () => {
    expect((await req('POST', '', { title: 'x', status: 'development' })).status).toBe(400);
    expect((await req('POST', '', { title: 'x', status: 'idea', devLevel: 1 })).status).toBe(400);
    const p = await create({ title: 'x', status: 'development', devLevel: 2 });
    expect(p).toMatchObject({ devLevel: 2 });
    expect(p.startedAt).toBeTruthy();
  });

  it('níveis de desenvolvimento são colunas independentes', async () => {
    const a = await create({ title: 'A', status: 'development', devLevel: 1 });
    await create({ title: 'B', status: 'development', devLevel: 2 });
    const res = await move(a.id, { status: 'development', devLevel: 2, index: 0 });
    expect(res.status).toBe(200);
    const list = (await req('GET', '')).body as Project[];
    const l2 = list.filter((p) => p.devLevel === 2).map((p) => p.title);
    expect(l2).toEqual(['A', 'B']);
    expect(list.filter((p) => p.devLevel === 1)).toHaveLength(0);
  });

  it('move até deploy e volta, ajustando datas', async () => {
    const p = await create({ title: 'App' });
    const dep = (await move(p.id, { status: 'deployed', index: 0 })).body as Project;
    expect(dep.startedAt && dep.finishedAt && dep.deployedAt).toBeTruthy();
    const back = (await move(p.id, { status: 'development', devLevel: 3, index: 0 }))
      .body as Project;
    expect(back).toMatchObject({
      devLevel: 3,
      finishedAt: null,
      deployedAt: null,
      startedAt: dep.startedAt,
    });
  });

  it('move inválido (development sem nível) = 400', async () => {
    const p = await create({ title: 'App' });
    expect((await move(p.id, { status: 'development', index: 0 })).status).toBe(400);
  });

  it('PATCH parcial preserva coluna; mudar nível exige status', async () => {
    const p = await create({ title: 'App', status: 'development', devLevel: 1 });
    const r = (
      await req('PATCH', `/${p.id}`, { title: 'App 2', repoUrl: 'https://github.com/x/y' })
    ).body;
    expect(r).toMatchObject({ title: 'App 2', status: 'development', devLevel: 1 });
    expect((await req('PATCH', `/${p.id}`, { devLevel: 2 })).status).toBe(400);
    const r2 = (await req('PATCH', `/${p.id}`, { status: 'development', devLevel: 3 })).body;
    expect(r2).toMatchObject({ devLevel: 3 });
  });

  it('excluir projeto libera a ideia de origem', async () => {
    const idea = (
      await app.inject({ method: 'POST', url: '/api/ideas', payload: { title: 'Ideia' } })
    ).json() as Idea;
    const { project } = (
      await app.inject({ method: 'POST', url: `/api/ideas/${idea.id}/promote` })
    ).json();
    expect((await req('DELETE', `/${project.id}`)).status).toBe(204);
    const ideas = (await app.inject('/api/ideas')).json() as Idea[];
    expect(ideas[0]!.promotedProjectId).toBeNull();
    expect((await req('DELETE', `/${project.id}`)).status).toBe(404);
  });
});
