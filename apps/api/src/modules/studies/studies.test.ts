import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StudySubject, StudySummary, TimeEntry } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';

let app: FastifyInstance;
let close: () => void;
const TODAY = '2026-11-08';

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

type M = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const req = async (method: M, url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const subject = async (body: object) =>
  (await req('POST', `/studies?today=${TODAY}`, body)).body as StudySubject;
const session = (refId: number, startedAt: string, durationSec: number) =>
  req('POST', '/time', { module: 'study', refId, startedAt, durationSec });
const list = async () => (await req('GET', `/studies?today=${TODAY}`)).body as StudySubject[];
const summary = async (today = TODAY) =>
  (await req('GET', `/studies/summary?today=${today}`)).body as StudySummary;

describe('/api/time', () => {
  it('valida horário local, duração e referência', async () => {
    const s = await subject({ name: 'TS' });
    expect((await session(s.id, '2026-11-08T10:00:00.000Z', 60)).status).toBe(400); // ISO com Z
    expect((await session(s.id, '2026-11-08T10:00', 0)).status).toBe(400);
    expect((await session(999, '2026-11-08T10:00', 60)).status).toBe(400);
    expect(
      (
        await req('POST', '/time', {
          module: 'work',
          refId: 1,
          startedAt: '2026-11-08T10:00',
          durationSec: 60,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await req('POST', '/time', {
          module: 'work',
          startedAt: '2026-11-08T10:00:30',
          durationSec: 60,
        })
      ).status,
    ).toBe(201);
  });

  it('filtra por módulo, referência e intervalo (dia inteiro incluso)', async () => {
    const s = await subject({ name: 'TS' });
    await session(s.id, '2026-11-01T23:59', 60);
    await session(s.id, '2026-11-05T08:00', 60);
    await req('POST', '/time', { module: 'work', startedAt: '2026-11-05T09:00', durationSec: 60 });
    const r = (await req('GET', `/time?module=study&refId=${s.id}&from=2026-11-01&to=2026-11-01`))
      .body as TimeEntry[];
    expect(r.map((e) => e.startedAt)).toEqual(['2026-11-01T23:59']);
  });
});

describe('/api/studies', () => {
  it('cria com defaults e estatísticas zeradas', async () => {
    const s = await subject({ name: 'Inglês' });
    expect(s).toMatchObject({
      level: 'beginner',
      progress: 0,
      totalSec: 0,
      weekSec: 0,
      sessions: 0,
      lastStudiedAt: null,
      archived: false,
    });
  });

  it('estatísticas: total, semana (7 dias até hoje) e última vez', async () => {
    const a = await subject({ name: 'A' });
    const b = await subject({ name: 'B' });
    await session(a.id, '2026-10-01T10:00', 3600); // fora da semana
    await session(a.id, '2026-11-02T10:00', 1800); // primeiro dia da janela (08 - 6)
    await session(a.id, '2026-11-08T21:00', 600);
    await session(b.id, '2026-11-07T10:00', 900);
    const [sa, sb] = await list();
    expect(sa).toMatchObject({
      totalSec: 6000,
      weekSec: 2400,
      sessions: 3,
      lastStudiedAt: '2026-11-08T21:00',
    });
    expect(sb).toMatchObject({ totalSec: 900, weekSec: 900, sessions: 1 });
  });

  it('PATCH parcial; arquivadas vão para o fim', async () => {
    const a = await subject({ name: 'A' });
    await subject({ name: 'B' });
    const r = (
      await req('PATCH', `/studies/${a.id}?today=${TODAY}`, { progress: 100, archived: true })
    ).body;
    expect(r).toMatchObject({ name: 'A', progress: 100, archived: true, level: 'beginner' });
    expect((await list()).map((s) => s.name)).toEqual(['B', 'A']);
    expect((await req('PATCH', `/studies/${a.id}?today=${TODAY}`, { progress: 101 })).status).toBe(
      400,
    );
  });

  it('exigem ?today', async () => {
    expect((await req('GET', '/studies')).status).toBe(400);
  });

  it('excluir matéria remove as sessões dela', async () => {
    const a = await subject({ name: 'A' });
    await session(a.id, '2026-11-08T10:00', 60);
    expect((await req('DELETE', `/studies/${a.id}`)).status).toBe(204);
    expect(((await req('GET', '/time?module=study')).body as TimeEntry[]).length).toBe(0);
    expect((await req('DELETE', `/studies/${a.id}`)).status).toBe(404);
  });
});

describe('/api/studies/summary', () => {
  it('sequência conta até hoje, ou até ontem se hoje ainda não estudou', async () => {
    const s = await subject({ name: 'A' });
    for (const d of ['2026-11-05', '2026-11-06', '2026-11-07'])
      await session(s.id, `${d}T10:00`, 600);
    let sum = await summary();
    expect(sum.streak).toBe(3); // 05,06,07 — hoje (08) ainda vale a sequência de ontem
    await session(s.id, '2026-11-08T22:00', 1200);
    sum = await summary();
    expect(sum.streak).toBe(4);
    expect(sum.weekSec).toBe(3 * 600 + 1200);
    expect(sum.last7).toHaveLength(7);
    expect(sum.last7.at(-1)).toEqual({ date: '2026-11-08', sec: 1200 });
    expect(sum.last7[0]!.date).toBe('2026-11-02');
    expect((await summary('2026-11-10')).streak).toBe(0); // pulou o dia 09
  });
});
