import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { FinanceActivity, FinanceEntry } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { buildApp } from '../../app';
import { describeChanges, formatCents } from './history';

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

type M = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const req = async (method: M, url: string, payload?: object) => {
  const res = await app.inject({ method, url: '/api/finance' + url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};
const create = async (body: object) => (await req('POST', '', body)).body as FinanceActivity;
const entries = async (id: number) => (await req('GET', `/${id}/entries`)).body as FinanceEntry[];

describe('describeChanges', () => {
  it('ignora campos iguais e resume dinheiro em BRL', () => {
    const d = describeChanges(
      { title: 'A', actualMonthlyCents: null, kind: 'job' },
      { title: 'A', actualMonthlyCents: 350000, kind: 'freelance' },
    );
    expect(d?.changes.map((c) => c.field)).toEqual(['kind', 'actualMonthlyCents']);
    expect(d?.summary).toBe('Tipo: Trabalho → Freelance\nRenda real: — → R$ 3.500,00');
  });
  it('nada mudou = null', () => {
    expect(describeChanges({ title: 'A' }, { title: 'A' })).toBeNull();
  });
  it('formatCents', () => expect(formatCents(123456)).toBe('R$ 1.234,56'));
});

describe('/api/finance', () => {
  it('cria com histórico inicial e estatísticas zeradas', async () => {
    const a = await create({
      title: 'Trabalho CLT',
      kind: 'job',
      status: 'active',
      actualMonthlyCents: 500000,
    });
    expect(a).toMatchObject({ status: 'active', openAlerts: 0, nextDueAt: null });
    const e = await entries(a.id);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ type: 'edit', content: 'Atividade criada' });
  });

  it('PATCH registra edição (diff) e mudança de status separadamente', async () => {
    const a = await create({ title: 'Canal YouTube', kind: 'content' });
    const r = await req('PATCH', `/${a.id}`, {
      expectedMonthlyCents: 200000,
      status: 'development',
      title: 'Canal YouTube',
    });
    expect(r.body).toMatchObject({ status: 'development', expectedMonthlyCents: 200000 });
    const e = await entries(a.id);
    expect(e.map((x) => x.type)).toEqual(['status_change', 'edit', 'edit']);
    expect(e[0]!.content).toBe('Movida de Ideias para Desenvolvimento');
    expect(e[1]!.content).toBe('Renda esperada: — → R$ 2.000,00');
    expect(e[1]!.meta?.changes).toHaveLength(1);
  });

  it('PATCH sem mudanças reais não polui o histórico', async () => {
    const a = await create({ title: 'X' });
    await req('PATCH', `/${a.id}`, { title: 'X' });
    expect(await entries(a.id)).toHaveLength(1);
  });

  it('mover entre colunas registra status; reordenar na mesma coluna não', async () => {
    const a = await create({ title: 'A' });
    const b = await create({ title: 'B' });
    await req('POST', `/${b.id}/move`, { status: 'idea', index: 0 });
    expect(await entries(b.id)).toHaveLength(1);
    const list = (await req('GET', '')).body as FinanceActivity[];
    expect(list.map((x) => x.title)).toEqual(['B', 'A']);
    await req('POST', `/${a.id}/move`, { status: 'active', index: 0 });
    expect((await entries(a.id))[0]).toMatchObject({
      type: 'status_change',
      meta: { from: 'idea', to: 'active' },
    });
  });

  it('avisos: contagem, próxima data, resolver e excluir', async () => {
    const a = await create({ title: 'Freela' });
    await req('POST', `/${a.id}/entries`, {
      type: 'alert',
      content: 'Emitir nota',
      dueAt: '2026-12-10T12:00:00.000Z',
    });
    const second = (
      await req('POST', `/${a.id}/entries`, {
        type: 'alert',
        content: 'Cobrar cliente',
        dueAt: '2026-11-20T12:00:00.000Z',
      })
    ).body as FinanceEntry;
    await req('POST', `/${a.id}/entries`, { type: 'note', content: 'Cliente gostou' });
    let card = ((await req('GET', '')).body as FinanceActivity[])[0]!;
    expect(card).toMatchObject({ openAlerts: 2, nextDueAt: '2026-11-20T12:00:00.000Z' });

    await req('PATCH', `/entries/${second.id}`, { resolved: true });
    card = ((await req('GET', '')).body as FinanceActivity[])[0]!;
    expect(card).toMatchObject({ openAlerts: 1, nextDueAt: '2026-12-10T12:00:00.000Z' });

    expect((await req('DELETE', `/entries/${second.id}`)).status).toBe(204);
  });

  it('observação não aceita data; histórico automático é imutável', async () => {
    const a = await create({ title: 'X' });
    expect(
      (
        await req('POST', `/${a.id}/entries`, {
          type: 'note',
          content: 'x',
          dueAt: '2026-12-10T12:00:00.000Z',
        })
      ).status,
    ).toBe(400);
    expect((await req('POST', `/${a.id}/entries`, { type: 'edit', content: 'hack' })).status).toBe(
      400,
    );
    const auto = (await entries(a.id))[0]!;
    expect((await req('PATCH', `/entries/${auto.id}`, { content: 'mudei' })).status).toBe(403);
    expect((await req('DELETE', `/entries/${auto.id}`)).status).toBe(403);
  });

  it('projeto vinculado precisa existir; excluir atividade apaga histórico', async () => {
    expect((await req('POST', '', { title: 'X', projectId: 999 })).status).toBe(400);
    const a = await create({ title: 'X' });
    expect((await req('DELETE', `/${a.id}`)).status).toBe(204);
    expect((await req('GET', `/${a.id}/entries`)).status).toBe(404);
  });
});
