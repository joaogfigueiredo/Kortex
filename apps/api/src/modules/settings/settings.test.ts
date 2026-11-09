import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { seed } from '../../db/seed';
import { buildApp } from '../../app';
import { COOKIE_NAME, makeToken, setPin } from '../auth/service';

let app: FastifyInstance;
let close: () => void;
/** Sessão de quem já digitou o PIN (com PIN ativo, a API exige o cookie). */
let headers: { cookie: string };

beforeEach(async () => {
  const { db, sqlite } = openDatabase(':memory:');
  runMigrations(db);
  seed(db);
  await setPin(db, '123456'); // cria pin_hash + session_secret de verdade
  headers = { cookie: `${COOKIE_NAME}=${makeToken(db)}` };
  app = await buildApp({ db, logger: false });
  close = () => sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

describe('/api/settings', () => {
  it('lista só chaves públicas (nunca o hash do PIN nem o segredo da sessão)', async () => {
    const body = (await app.inject({ url: '/api/settings', headers })).json();
    expect(body).toMatchObject({ theme: 'system', locale: 'pt-BR' });
    expect(Object.keys(body).sort()).toEqual(['locale', 'theme', 'week_start']);
  });

  it('atualiza o tema', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings/theme',
      payload: { value: 'dark' },
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/settings', headers })).json().theme).toBe('dark');
  });

  it('valida valor e recusa chaves internas (pin_hash, session_secret)', async () => {
    const bad = await app.inject({
      method: 'PUT',
      url: '/api/settings/theme',
      payload: { value: 'neon' },
      headers,
    });
    expect(bad.statusCode).toBe(400);
    for (const key of ['pin_hash', 'session_secret', 'pin_numeric']) {
      const r = await app.inject({
        method: 'PUT',
        url: `/api/settings/${key}`,
        payload: { value: 'x' },
        headers,
      });
      expect(r.statusCode).toBe(404);
    }
  });
});
