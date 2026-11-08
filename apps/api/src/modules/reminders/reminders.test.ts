import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Occurrence, Reminder, ReminderCategory } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { seed } from '../../db/seed';
import { buildApp } from '../../app';
import { addDays, expandDates, weekdayOf, type RecurrenceRule } from './recurrence';

const rule = (r: Partial<RecurrenceRule>): RecurrenceRule => ({
  startAt: '2026-01-31T09:00',
  recurrence: 'none',
  recurrenceWeekdays: null,
  recurrenceUntil: null,
  ...r,
});

describe('recurrence', () => {
  it('aritmética de datas sem fuso', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // bissexto
    expect(weekdayOf('2026-11-08')).toBe(0); // domingo
  });

  it('none: só no dia de início, se estiver no intervalo', () => {
    expect(expandDates(rule({}), '2026-01-01', '2026-02-28')).toEqual(['2026-01-31']);
    expect(expandDates(rule({}), '2026-02-01', '2026-02-28')).toEqual([]);
  });

  it('daily respeita início e "até"', () => {
    const r = rule({
      startAt: '2026-03-10T08:00',
      recurrence: 'daily',
      recurrenceUntil: '2026-03-12',
    });
    expect(expandDates(r, '2026-03-01', '2026-03-31')).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
    ]);
  });

  it('weekly com dias escolhidos (Seg+Qua+Sex)', () => {
    const r = rule({
      startAt: '2026-11-02T07:00',
      recurrence: 'weekly',
      recurrenceWeekdays: 0b0101010,
    });
    expect(expandDates(r, '2026-11-01', '2026-11-08')).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-06',
    ]);
  });

  it('weekly sem máscara usa o dia da semana do início', () => {
    const r = rule({ startAt: '2026-11-03T07:00', recurrence: 'weekly' }); // terça
    expect(expandDates(r, '2026-11-01', '2026-11-17')).toEqual([
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
    ]);
  });

  it('monthly no dia 31 cai no último dia dos meses curtos', () => {
    const r = rule({ recurrence: 'monthly' }); // 31/01
    expect(expandDates(r, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
    expect(expandDates(r, '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
  });
});

let app: FastifyInstance;
let close: () => void;

beforeEach(async () => {
  const { db, sqlite } = openDatabase(':memory:');
  runMigrations(db);
  seed(db);
  app = await buildApp({ db, logger: false });
  close = () => sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

type M = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const req = async (method: M, url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api/reminders' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const occ = async (from: string, to: string) =>
  (await req('GET', `/occurrences?from=${from}&to=${to}`)).body as Occurrence[];

describe('/api/reminders', () => {
  it('categorias do seed têm cor', async () => {
    const cats = (await req('GET', '/categories')).body as ReminderCategory[];
    expect(cats.length).toBeGreaterThanOrEqual(6);
    expect(cats[0]!.color).toMatch(/^#/);
  });

  it('valida horário flutuante, fim >= início e dias da semana', async () => {
    expect(
      (await req('POST', '', { title: 'x', startAt: '2026-11-10T15:00:00.000Z' })).status,
    ).toBe(400);
    expect(
      (
        await req('POST', '', {
          title: 'x',
          startAt: '2026-11-10T15:00',
          endAt: '2026-11-10T14:00',
        })
      ).status,
    ).toBe(400);
    expect(
      (await req('POST', '', { title: 'x', startAt: '2026-11-10T15:00', recurrence: 'weekly' }))
        .status,
    ).toBe(400);
    expect(
      (await req('POST', '', { title: 'x', startAt: '2026-11-10T15:00', categoryId: 999 })).status,
    ).toBe(400);
  });

  it('ocorrências com cor, horário e ordenação (dia todo primeiro)', async () => {
    await req('POST', '', {
      title: 'Dentista',
      kind: 'appointment',
      startAt: '2026-11-10T15:00',
      endAt: '2026-11-10T16:00',
      categoryId: 3,
    });
    await req('POST', '', {
      title: 'Aniversário',
      startAt: '2026-11-10T00:00',
      allDay: true,
      categoryId: 2,
    });
    await req('POST', '', { title: 'Academia', startAt: '2026-11-09T07:00', recurrence: 'daily' });
    const list = await occ('2026-11-10', '2026-11-10');
    expect(list.map((o) => o.title)).toEqual(['Aniversário', 'Academia', 'Dentista']);
    expect(list[2]).toMatchObject({
      time: '15:00',
      endTime: '16:00',
      color: '#4DF5B8',
      kind: 'appointment',
    });
    expect(list[0]).toMatchObject({ time: null, allDay: true });
  });

  it('concluir ocorrência: recorrente por dia, simples no próprio lembrete', async () => {
    const daily = (
      await req('POST', '', { title: 'Água', startAt: '2026-11-01T08:00', recurrence: 'daily' })
    ).body as Reminder;
    const once = (await req('POST', '', { title: 'Pagar boleto', startAt: '2026-11-05T10:00' }))
      .body as Reminder;

    expect((await req('PUT', `/${daily.id}/occurrences/2026-11-03`, { done: true })).status).toBe(
      200,
    );
    await req('PUT', `/${once.id}/occurrences/2026-11-05`, { done: true });
    let list = await occ('2026-11-02', '2026-11-05');
    const done = list.filter((o) => o.done).map((o) => `${o.title}@${o.date}`);
    expect(done).toEqual(['Água@2026-11-03', 'Pagar boleto@2026-11-05']);

    await req('PUT', `/${daily.id}/occurrences/2026-11-03`, { done: false });
    list = await occ('2026-11-03', '2026-11-03');
    expect(list[0]!.done).toBe(false);

    // data em que não ocorre
    expect((await req('PUT', `/${once.id}/occurrences/2026-11-06`, { done: true })).status).toBe(
      400,
    );
  });

  it('PATCH revalida regras no estado final e limpa campos da recorrência', async () => {
    const r = (
      await req('POST', '', {
        title: 'Treino',
        startAt: '2026-11-02T07:00',
        recurrence: 'weekly',
        recurrenceWeekdays: 2,
      })
    ).body as Reminder;
    expect((await req('PATCH', `/${r.id}`, { recurrenceWeekdays: null })).status).toBe(400);
    const res = (await req('PATCH', `/${r.id}`, { recurrence: 'none' })).body as Reminder;
    expect(res).toMatchObject({
      recurrence: 'none',
      recurrenceWeekdays: null,
      recurrenceUntil: null,
    });
  });

  it('limita o intervalo e valida from <= to', async () => {
    expect((await req('GET', '/occurrences?from=2026-01-01&to=2028-01-01')).status).toBe(400);
    expect((await req('GET', '/occurrences?from=2026-02-01&to=2026-01-01')).status).toBe(400);
  });

  it('excluir categoria deixa o lembrete sem cor', async () => {
    const cat = (await req('POST', '/categories', { name: 'Temp', color: '#123456' }))
      .body as ReminderCategory;
    await req('POST', '', { title: 'X', startAt: '2026-11-10T10:00', categoryId: cat.id });
    expect((await req('DELETE', `/categories/${cat.id}`)).status).toBe(204);
    const [o] = await occ('2026-11-10', '2026-11-10');
    expect(o).toMatchObject({ categoryId: null, color: null });
  });
});
