import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Meal, WellnessDay, WellnessSummary, Workout } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';
import { dietPct } from './service';

let app: FastifyInstance;
let close: () => void;
const TODAY = '2026-11-08'; // domingo

beforeEach(async () => {
  const { db, sqlite } = openDatabase(':memory:');
  runMigrations(db); // sem seed: plano de refeições vazio
  app = await buildApp({ db, logger: false });
  close = () => sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

type M = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const req = async (method: M, url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const meal = async (body: object) => (await req('POST', '/meals', body)).body as Meal;
const day = async (date: string) =>
  (await req('GET', `/wellness/day?date=${date}`)).body as WellnessDay;
const summary = async () =>
  (await req('GET', `/wellness/summary?today=${TODAY}`)).body as WellnessSummary;

describe('dietPct', () => {
  it('feita = 1, parcial = 0,5; sem plano = null', () => {
    expect(dietPct(4, 2, 1)).toBe(63); // 2,5/4
    expect(dietPct(3, 3, 0)).toBe(100);
    expect(dietPct(0, 0, 0)).toBeNull();
  });
});

describe('treinos', () => {
  it('CRUD, validação e tipos por frequência', async () => {
    expect((await req('POST', '/workouts', { date: TODAY, type: '' })).status).toBe(400);
    expect(
      (await req('POST', '/workouts', { date: TODAY, type: 'Corrida', intensity: 6 })).status,
    ).toBe(400);
    const w = (
      await req('POST', '/workouts', {
        date: TODAY,
        type: 'Corrida',
        durationMin: 30,
        intensity: 3,
      })
    ).body as Workout;
    await req('POST', '/workouts', { date: '2026-11-07', type: 'Musculação', durationMin: 60 });
    await req('POST', '/workouts', { date: '2026-11-06', type: 'Musculação', durationMin: 50 });
    expect((await req('GET', '/workouts/types')).body).toEqual(['Musculação', 'Corrida']);
    const r = (await req('PATCH', `/workouts/${w.id}`, { durationMin: 40 })).body as Workout;
    expect(r).toMatchObject({ type: 'Corrida', durationMin: 40, intensity: 3 });
    const list = (await req('GET', '/workouts?from=2026-11-07&to=2026-11-08')).body as Workout[];
    expect(list.map((x) => x.date)).toEqual(['2026-11-08', '2026-11-07']);
    expect((await req('DELETE', `/workouts/${w.id}`)).status).toBe(204);
    expect((await req('DELETE', `/workouts/${w.id}`)).status).toBe(404);
  });
});

describe('refeições', () => {
  it('dia mostra só refeições ativas previstas para o dia da semana', async () => {
    await meal({ name: 'Café', time: '07:30' });
    await meal({ name: 'Marmita do trabalho', time: '12:00', weekdays: 0b0111110 }); // seg–sex
    const ceia = await meal({ name: 'Ceia', time: '22:00' });
    await req('PATCH', `/meals/${ceia.id}`, { active: false });
    expect((await day(TODAY)).meals.map((m) => m.name)).toEqual(['Café']); // domingo
    expect((await day('2026-11-09')).meals.map((m) => m.name)).toEqual([
      'Café',
      'Marmita do trabalho',
    ]);
  });

  it('marcar, remarcar (upsert) e limpar; recusa dia fora do plano', async () => {
    const m = await meal({ name: 'Almoço', weekdays: 0b0111110 });
    expect((await req('PUT', `/meals/${m.id}/logs/${TODAY}`, { status: 'done' })).status).toBe(400); // domingo
    await req('PUT', `/meals/${m.id}/logs/2026-11-09`, { status: 'done' });
    await req('PUT', `/meals/${m.id}/logs/2026-11-09`, { status: 'partial', note: 'metade' });
    let d = await day('2026-11-09');
    expect(d.meals[0]!.log).toMatchObject({ status: 'partial', note: 'metade' });
    await req('DELETE', `/meals/${m.id}/logs/2026-11-09`);
    d = await day('2026-11-09');
    expect(d.meals[0]!.log).toBeNull();
  });

  it('weekdays = 0 é inválido; excluir remove marcações', async () => {
    expect((await req('POST', '/meals', { name: 'X', weekdays: 0 })).status).toBe(400);
    const m = await meal({ name: 'X' });
    await req('PUT', `/meals/${m.id}/logs/${TODAY}`, { status: 'done' });
    expect((await req('DELETE', `/meals/${m.id}`)).status).toBe(204);
    expect((await day(TODAY)).meals).toHaveLength(0);
  });
});

describe('/wellness/summary', () => {
  it('sem nenhum registro: aderência null (não 0%)', async () => {
    await meal({ name: 'Café' });
    expect(await summary()).toMatchObject({ loggedDays: 0, dietPct: null });
  });

  it('dia com tudo "pulado" conta como registrado (0%)', async () => {
    const m = await meal({ name: 'Café' });
    await req('PUT', `/meals/${m.id}/logs/${TODAY}`, { status: 'skipped' });
    expect(await summary()).toMatchObject({ loggedDays: 1, dietPct: 0 });
  });

  it('semana: treinos, minutos, dias ativos e aderência média', async () => {
    const cafe = await meal({ name: 'Café' });
    const almoco = await meal({ name: 'Almoço' });
    // sábado 07: 2/2 feitas = 100% · domingo 08: 1 feita + 1 parcial = 75%
    await req('PUT', `/meals/${cafe.id}/logs/2026-11-07`, { status: 'done' });
    await req('PUT', `/meals/${almoco.id}/logs/2026-11-07`, { status: 'done' });
    await req('PUT', `/meals/${cafe.id}/logs/${TODAY}`, { status: 'done' });
    await req('PUT', `/meals/${almoco.id}/logs/${TODAY}`, { status: 'partial' });
    await req('POST', '/workouts', { date: TODAY, type: 'Corrida', durationMin: 30 });
    await req('POST', '/workouts', { date: TODAY, type: 'Alongamento', durationMin: 10 });
    await req('POST', '/workouts', { date: '2026-11-03', type: 'Bike', durationMin: 45 });
    await req('POST', '/workouts', { date: '2026-10-30', type: 'Bike', durationMin: 99 }); // fora

    const s = await summary();
    expect(s).toMatchObject({ weekWorkouts: 3, weekWorkoutMin: 85, activeDays: 2 });
    expect(s.last7).toHaveLength(7);
    expect(s.last7.at(-1)).toMatchObject({
      date: TODAY,
      workoutMin: 40,
      mealsPlanned: 2,
      dietPct: 75,
    });
    expect(s.last7.at(-2)!.dietPct).toBe(100);
    // Só dias registrados entram na média: (100 + 75) / 2 = 88 (dias sem marcação não viram 0%)
    expect(s).toMatchObject({ loggedDays: 2, dietPct: 88 });
  });
});
