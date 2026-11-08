import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DailyGoal, GoalOfDay, GoalsSummary } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';
import { goalStreak } from './service';

let app: FastifyInstance;
let close: () => void;
const TODAY = '2026-11-08'; // domingo
const MWF = 0b0101010; // seg, qua, sex

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

type M = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const req = async (method: M, url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api/goals' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const goal = async (body: object) => (await req('POST', '', body)).body as DailyGoal;
const check = (id: number, date: string, done = true) =>
  req('PUT', `/${id}/checks/${date}`, { done });
const day = async (date = TODAY) => (await req('GET', `/day?date=${date}`)).body as GoalOfDay[];
const summary = async (today = TODAY) =>
  (await req('GET', `/summary?today=${today}`)).body as GoalsSummary;

describe('goalStreak', () => {
  const set = (...k: string[]) => new Set(k.map((d) => `1|${d}`));
  it('diária: hoje pendente não quebra; buraco quebra', () => {
    const g = { id: 1, weekdays: 127 };
    expect(goalStreak(g, set('2026-11-06', '2026-11-07'), TODAY)).toBe(2);
    expect(goalStreak(g, set('2026-11-06', '2026-11-07', TODAY), TODAY)).toBe(3);
    expect(goalStreak(g, set('2026-11-05', '2026-11-07'), TODAY)).toBe(1);
  });
  it('seg/qua/sex: dias não previstos são pulados', () => {
    const g = { id: 1, weekdays: MWF };
    // sex 06, qua 04, seg 02 → 3 (sáb/dom/ter/qui não contam)
    expect(goalStreak(g, set('2026-11-02', '2026-11-04', '2026-11-06'), TODAY)).toBe(3);
  });
});

describe('/api/goals', () => {
  it('cria, valida dias e ordena por posição', async () => {
    expect((await req('POST', '', { title: 'X', weekdays: 0 })).status).toBe(400);
    await goal({ title: 'Água', icon: 'droplet' });
    await goal({ title: 'Ler' });
    const list = (await req('GET', '')).body as DailyGoal[];
    expect(list.map((g) => g.title)).toEqual(['Água', 'Ler']);
    expect(list[0]).toMatchObject({ weekdays: 127, active: true, icon: 'droplet' });
  });

  it('dia: só metas ativas previstas, com done e streak', async () => {
    const agua = await goal({ title: 'Água' });
    const treino = await goal({ title: 'Treino', weekdays: MWF });
    const off = await goal({ title: 'Off' });
    await req('PATCH', `/${off.id}`, { active: false });
    await check(agua.id, '2026-11-07');
    await check(agua.id, TODAY);
    let d = await day(); // domingo: treino não vale
    expect(d.map((g) => g.title)).toEqual(['Água']);
    expect(d[0]).toMatchObject({ done: true, streak: 2 });
    d = await day('2026-11-09');
    expect(d.map((g) => g.title)).toEqual(['Água', 'Treino']);
    expect((await check(treino.id, TODAY)).status).toBe(400); // domingo
  });

  it('desmarcar remove o check; marcar duas vezes é idempotente', async () => {
    const g = await goal({ title: 'Água' });
    await check(g.id, TODAY);
    await check(g.id, TODAY);
    expect((await day())[0]!.done).toBe(true);
    await check(g.id, TODAY, false);
    expect((await day())[0]!.done).toBe(false);
  });

  it('resumo: % da semana e sequência de dias perfeitos', async () => {
    const a = await goal({ title: 'A' });
    const b = await goal({ title: 'B', weekdays: MWF });
    // 5 a 7 (qui, sex, sáb): A todo dia; B na sexta
    for (const d of ['2026-11-05', '2026-11-06', '2026-11-07']) await check(a.id, d);
    await check(b.id, '2026-11-06');
    let s = await summary();
    expect(s.perfectStreak).toBe(3); // hoje pendente não quebra
    // semana 02..08: A previsto 7x (3 feitos), B previsto seg/qua/sex = 3x (1 feito) → 4/10
    expect(s.weekPct).toBe(40);
    expect(s.last7).toHaveLength(7);
    await check(a.id, TODAY);
    s = await summary();
    expect(s.perfectStreak).toBe(4);
    expect(s.last7.at(-1)).toEqual({ date: TODAY, planned: 1, done: 1 });
  });

  it('sem metas: resumo vazio sem erro', async () => {
    expect(await summary()).toMatchObject({ weekPct: null, perfectStreak: 0 });
  });

  it('excluir meta remove os checks', async () => {
    const g = await goal({ title: 'X' });
    await check(g.id, TODAY);
    expect((await req('DELETE', `/${g.id}`)).status).toBe(204);
    expect(await day()).toEqual([]);
    expect((await req('DELETE', `/${g.id}`)).status).toBe(404);
  });
});
