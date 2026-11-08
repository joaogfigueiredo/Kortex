import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DashboardData } from '@kortex/shared';
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

const post = async (url: string, payload: object) =>
  (await app.inject({ method: 'POST', url: '/api' + url, payload })).json();
const put = (url: string, payload: object) =>
  app.inject({ method: 'PUT', url: '/api' + url, payload });
const dash = async (range = 'week') =>
  (await app.inject(`/api/dashboard?today=${TODAY}&range=${range}`)).json() as DashboardData;
const time = (module: string, startedAt: string, durationSec: number, refId?: number) =>
  post('/time', { module, startedAt, durationSec, refId });

describe('/api/dashboard', () => {
  it('banco vazio: estrutura completa e zerada', async () => {
    const d = await dash();
    expect(d).toMatchObject({
      range: 'week',
      from: '2026-11-02',
      to: TODAY,
      workDays: 0,
      activeDays: 0,
    });
    expect(d.timeByDay).toHaveLength(7);
    expect(d.kpis).toEqual({
      focusSec: 0,
      studySec: 0,
      workouts: 0,
      workoutMin: 0,
      dietPct: null,
      goalsPct: null,
    });
    expect(d.projectsByStatus).toEqual({
      idea: 0,
      started: 0,
      development: 0,
      done: 0,
      deployed: 0,
    });
  });

  it('intervalos: dia = 1, semana = 7, mês = 30 dias', async () => {
    expect((await dash('day')).timeByDay.map((d) => d.date)).toEqual([TODAY]);
    const m = await dash('month');
    expect(m.timeByDay).toHaveLength(30);
    expect(m.from).toBe('2026-10-10');
    expect((await app.inject(`/api/dashboard?today=${TODAY}&range=year`)).statusCode).toBe(400);
  });

  it('tempo por área e por dia, KPIs e período anterior', async () => {
    const s = await post(`/studies?today=${TODAY}`, { name: 'Inglês', color: '#B79CFF' });
    await time('study', '2026-11-08T09:00', 1800, s.id);
    await time('study', '2026-11-07T23:59:59', 600, s.id); // fim do dia ainda conta no dia 07
    await time('work', '2026-11-08T10:00', 3600);
    await time('work', '2026-11-05T10:00', 1200);
    await time('study', '2026-10-30T10:00', 900, s.id); // período anterior (26/10–01/11)
    await time('study', '2026-10-01T10:00', 999, s.id); // fora de tudo

    const d = await dash();
    expect(d.timeByDay.at(-1)).toMatchObject({ date: TODAY, study: 1800, work: 3600 });
    expect(d.timeByDay.at(-2)).toMatchObject({ date: '2026-11-07', study: 600 });
    expect(d.kpis).toMatchObject({ focusSec: 1800 + 600 + 3600 + 1200, studySec: 2400 });
    expect(d.prev).toMatchObject({ focusSec: 900, studySec: 900 });
    expect(d.studyBySubject).toEqual([{ id: s.id, name: 'Inglês', color: '#B79CFF', sec: 2400 }]);
    expect(d.workDays).toBe(2);
    expect(d.activeDays).toBe(3);
  });

  it('projetos: tempo, dias ativos e última atividade (continuidade)', async () => {
    const p = await post('/projects', { title: 'Kortex', status: 'development', devLevel: 2 });
    await post('/projects', { title: 'Blog', status: 'deployed' });
    await time('project', '2026-11-03T20:00', 3600, p.id);
    await time('project', '2026-11-03T22:00', 1800, p.id);
    await time('project', '2026-11-06T20:00', 2400, p.id);
    const d = await dash();
    expect(d.projects).toEqual([
      {
        id: p.id,
        title: 'Kortex',
        status: 'development',
        sec: 7800,
        activeDays: 2,
        lastAt: '2026-11-06T20:00',
      },
    ]);
    expect(d.projectsByStatus).toMatchObject({ development: 1, deployed: 1 });
  });

  it('treinos, dieta e metas por dia', async () => {
    await post('/workouts', { date: TODAY, type: 'Corrida', durationMin: 30 });
    await post('/workouts', { date: '2026-11-04', type: 'Bike', durationMin: 45 });
    const meal = await post('/meals', { name: 'Almoço' });
    await put(`/meals/${meal.id}/logs/${TODAY}`, { status: 'partial' });
    const g = await post('/goals', { title: 'Água' });
    await put(`/goals/${g.id}/checks/${TODAY}`, { done: true });

    const d = await dash();
    expect(d.kpis).toMatchObject({ workouts: 2, workoutMin: 75, dietPct: 50 });
    expect(d.kpis.goalsPct).toBe(14); // 1 de 7 dias previstos
    expect(d.workoutsByDay.at(-1)).toEqual({ date: TODAY, min: 30, count: 1 });
    expect(d.dietByDay.at(-1)).toEqual({ date: TODAY, pct: 50, logged: true });
    expect(d.dietByDay[0]).toMatchObject({ logged: false });
    expect(d.goalsByDay.at(-1)).toEqual({ date: TODAY, planned: 1, done: 1 });
    expect(d.streaks.goalsPerfect).toBe(1);
  });

  it('ideias e finanças', async () => {
    await post('/ideas', { title: 'A' });
    await post('/ideas', { title: 'B', status: 'done' });
    const f = await post('/finance', {
      title: 'CLT',
      status: 'active',
      actualMonthlyCents: 500000,
    });
    await post('/finance', { title: 'Freela', status: 'active', actualMonthlyCents: 150000 });
    await post(`/finance/${f.id}/entries`, { type: 'alert', content: 'Holerite' });
    const d = await dash();
    expect(d.ideas.byStatus).toMatchObject({ organized: 1, done: 1 });
    // created/completed dependem do relógio real (created_at/completed_at = agora); não fixar aqui.
    expect(d.finance).toMatchObject({
      activeIncomeCents: 650000,
      openAlerts: 1,
      byStatus: { active: 2 },
    });
  });
});
