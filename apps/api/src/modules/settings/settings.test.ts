import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { seed } from '../../db/seed';
import { settings } from '../../db/schema';
import { buildApp } from '../../app';

let app: FastifyInstance;
let close: () => void;

beforeEach(async () => {
  const { db, sqlite } = openDatabase(':memory:');
  runMigrations(db);
  seed(db);
  db.insert(settings).values({ key: 'pin_hash', value: 'segredo' }).run();
  app = await buildApp({ db, logger: false });
  close = () => sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

describe('/api/settings', () => {
  it('lista só chaves públicas', async () => {
    const body = (await app.inject('/api/settings')).json();
    expect(body).toMatchObject({ theme: 'system', locale: 'pt-BR' });
    expect(body).not.toHaveProperty('pin_hash');
  });

  it('atualiza o tema', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings/theme',
      payload: { value: 'dark' },
    });
    expect(res.statusCode).toBe(200);
    expect((await app.inject('/api/settings')).json().theme).toBe('dark');
  });

  it('valida valor e chave', async () => {
    const bad = await app.inject({
      method: 'PUT',
      url: '/api/settings/theme',
      payload: { value: 'neon' },
    });
    expect(bad.statusCode).toBe(400);
    const pin = await app.inject({
      method: 'PUT',
      url: '/api/settings/pin_hash',
      payload: { value: 'x' },
    });
    expect(pin.statusCode).toBe(404);
  });
});
