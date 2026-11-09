import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { AuthStatus, NetworkInfo } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { seed } from '../../db/seed';
import { settings } from '../../db/schema';
import { buildApp } from '../../app';
import { networkInfo } from '../network/service';
import { COOKIE_NAME, createLimiter, makeToken, verifyToken } from './service';

let app: FastifyInstance;
let db: ReturnType<typeof openDatabase>['db'];
let close: () => void;

beforeEach(async () => {
  const conn = openDatabase(':memory:');
  db = conn.db;
  runMigrations(db);
  seed(db);
  app = await buildApp({ db, logger: false });
  close = () => conn.sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
});

type M = 'GET' | 'POST' | 'PUT' | 'DELETE';
const call = (method: M, url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({ method, url, payload, headers });
/** "kortex_session=…" pronto para reenviar, extraído do Set-Cookie. */
const cookieOf = (res: LightMyRequestResponse) => String(res.headers['set-cookie']).split(';')[0]!;
const status = async (cookie?: string) =>
  (await call('GET', '/api/auth/status', undefined, cookie ? { cookie } : {})).json() as AuthStatus;

async function enablePin(pin = '123456') {
  const res = await call('POST', '/api/auth/pin', { pin });
  expect(res.statusCode).toBe(200);
  return cookieOf(res);
}

describe('sem PIN (padrão)', () => {
  it('tudo aberto; status mostra PIN desligado', async () => {
    expect(await status()).toEqual({ pinEnabled: false, numeric: false, authenticated: true });
    expect((await call('GET', '/api/ideas')).statusCode).toBe(200);
  });

  it('login sem PIN ativo é um "ok" inofensivo', async () => {
    expect((await call('POST', '/api/auth/login', { pin: 'x' })).statusCode).toBe(200);
  });
});

describe('com PIN', () => {
  it('define o PIN, valida tamanho e mantém quem definiu logado', async () => {
    expect((await call('POST', '/api/auth/pin', { pin: '12' })).statusCode).toBe(400);
    const cookie = await enablePin();
    expect(await status()).toEqual({ pinEnabled: true, numeric: true, authenticated: false });
    expect(await status(cookie)).toMatchObject({ authenticated: true });
    expect((await call('GET', '/api/ideas', undefined, { cookie })).statusCode).toBe(200);
  });

  it('o PIN fica só como hash scrypt (nunca em texto)', async () => {
    await enablePin('segredo-2026');
    const rows = db.select().from(settings).all();
    const hash = rows.find((r) => r.key === 'pin_hash')!.value;
    expect(hash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(rows)).not.toContain('segredo-2026');
    expect(rows.find((r) => r.key === 'pin_numeric')!.value).toBe('0');
  });

  it('bloqueia a API (401) mas libera health, status e login', async () => {
    await enablePin();
    for (const url of [
      '/api/ideas',
      '/api/settings',
      '/api/export',
      '/api/backups',
      '/api/network',
    ]) {
      const r = await call('GET', url);
      expect([url, r.statusCode, r.json().code]).toEqual([url, 401, 'AUTH_REQUIRED']);
    }
    expect((await call('POST', '/api/backups')).statusCode).toBe(401);
    expect((await call('GET', '/api/health')).statusCode).toBe(200);
    expect((await call('GET', '/api/auth/status')).statusCode).toBe(200);
  });

  it('login: PIN errado = 401 sem cookie; certo = cookie HttpOnly + acesso', async () => {
    await enablePin();
    const bad = await call('POST', '/api/auth/login', { pin: '000000' });
    expect(bad.statusCode).toBe(401);
    expect(bad.headers['set-cookie']).toBeUndefined();

    const ok = await call('POST', '/api/auth/login', { pin: '123456' });
    expect(ok.statusCode).toBe(200);
    const raw = String(ok.headers['set-cookie']);
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Lax');
    expect(raw).not.toContain('Secure'); // HTTP simples
    expect((await call('GET', '/api/ideas', undefined, { cookie: cookieOf(ok) })).statusCode).toBe(
      200,
    );
  });

  it('cookie só é "Secure" atrás de HTTPS (Tailscale Serve)', async () => {
    await enablePin();
    const r = await call(
      'POST',
      '/api/auth/login',
      { pin: '123456' },
      { 'x-forwarded-proto': 'https' },
    );
    expect(String(r.headers['set-cookie'])).toContain('; Secure');
  });

  it('cookie adulterado, expirado ou de outro segredo é recusado', async () => {
    const cookie = await enablePin();
    const [exp, sig] = cookie.split('=')[1]!.split('.');
    const tamper = (c: string) => call('GET', '/api/ideas', undefined, { cookie: c });
    expect((await tamper(`${COOKIE_NAME}=${Number(exp) + 1}.${sig}`)).statusCode).toBe(401);
    expect((await tamper(`${COOKIE_NAME}=${exp}.AAAA`)).statusCode).toBe(401);
    expect((await tamper(`${COOKIE_NAME}=lixo`)).statusCode).toBe(401);
    expect(verifyToken(db, makeToken(db, Date.now() - 31 * 24 * 3600 * 1000))).toBe(false); // expirado
    expect(verifyToken(db, makeToken(db))).toBe(true);
  });

  it('trocar o PIN exige o atual, derruba as outras sessões e mantém a sua', async () => {
    const old = await enablePin('111111');
    expect(
      (await call('POST', '/api/auth/pin', { pin: '222222' }, { cookie: old })).statusCode,
    ).toBe(400); // sem currentPin
    expect(
      (
        await call(
          'POST',
          '/api/auth/pin',
          { pin: '222222', currentPin: 'errado' },
          { cookie: old },
        )
      ).statusCode,
    ).toBe(401);

    const changed = await call(
      'POST',
      '/api/auth/pin',
      { pin: '222222', currentPin: '111111' },
      { cookie: old },
    );
    expect(changed.statusCode).toBe(200);
    expect((await call('GET', '/api/ideas', undefined, { cookie: old })).statusCode).toBe(401); // sessão antiga caiu
    expect(
      (await call('GET', '/api/ideas', undefined, { cookie: cookieOf(changed) })).statusCode,
    ).toBe(200);
    expect((await call('POST', '/api/auth/login', { pin: '111111' })).statusCode).toBe(401);
    expect((await call('POST', '/api/auth/login', { pin: '222222' })).statusCode).toBe(200);
  });

  it('trocar o PIN sem estar logado é barrado', async () => {
    await enablePin();
    expect(
      (await call('POST', '/api/auth/pin', { pin: '999999', currentPin: '123456' })).statusCode,
    ).toBe(401);
  });

  it('remover o PIN exige o PIN atual e reabre tudo', async () => {
    const cookie = await enablePin();
    expect(
      (await call('POST', '/api/auth/pin/remove', { currentPin: 'errado' }, { cookie })).statusCode,
    ).toBe(401);
    expect(
      (await call('POST', '/api/auth/pin/remove', { currentPin: '123456' }, { cookie })).statusCode,
    ).toBe(200);
    expect(await status()).toMatchObject({ pinEnabled: false, authenticated: true });
    expect((await call('GET', '/api/ideas')).statusCode).toBe(200);
    expect(
      db
        .select()
        .from(settings)
        .all()
        .some((r) => r.key === 'session_secret'),
    ).toBe(false);
  });

  it('logout apaga o cookie', async () => {
    const cookie = await enablePin();
    const r = await call('POST', '/api/auth/logout', undefined, { cookie });
    expect(String(r.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('após 5 erros seguidos trava com 429 + Retry-After, até com o PIN certo', async () => {
    await enablePin();
    for (let i = 0; i < 5; i++)
      expect((await call('POST', '/api/auth/login', { pin: 'x' + i })).statusCode).toBe(401);
    const locked = await call('POST', '/api/auth/login', { pin: '123456' });
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(locked.json().error).toMatch(/Aguarde/);
  });
});

describe('limitador (relógio simulado)', () => {
  it('trava a partir do 5º erro, dobra o tempo e libera depois', () => {
    let t = 1_000_000;
    const lim = createLimiter(() => t);
    for (let i = 0; i < 4; i++) lim.fail('ip');
    expect(lim.retryAfter('ip')).toBe(0);
    lim.fail('ip'); // 5º
    expect(lim.retryAfter('ip')).toBe(30);
    t += 31_000;
    expect(lim.retryAfter('ip')).toBe(0);
    lim.fail('ip'); // 6º → 60 s
    expect(lim.retryAfter('ip')).toBe(60);
    for (let i = 0; i < 20; i++) lim.fail('ip');
    expect(lim.retryAfter('ip')).toBe(15 * 60); // teto
    lim.success('ip');
    expect(lim.retryAfter('ip')).toBe(0);
    expect(lim.retryAfter('outro')).toBe(0); // chaves independentes
  });
});

describe('proteção contra outros sites (CSRF)', () => {
  it('recusa pedido que altera dados vindo de outra origem; aceita a mesma', async () => {
    const evil = await call(
      'POST',
      '/api/ideas',
      { title: 'x' },
      { origin: 'https://evil.example', host: 'localhost:3333' },
    );
    expect(evil.statusCode).toBe(403);
    expect(evil.json().code).toBe('BAD_ORIGIN');
    expect(
      (await call('POST', '/api/ideas', { title: 'x' }, { origin: 'null', host: 'localhost:3333' }))
        .statusCode,
    ).toBe(403);
    const same = await call(
      'POST',
      '/api/ideas',
      { title: 'ok' },
      { origin: 'http://localhost:3333', host: 'localhost:3333' },
    );
    expect(same.statusCode).toBe(201);
  });

  it('não tem CORS: nenhum cabeçalho Access-Control-Allow-Origin', async () => {
    const r = await call('GET', '/api/ideas', undefined, { origin: 'https://evil.example' });
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('cabeçalhos de segurança e API sem cache', async () => {
    const r = await call('GET', '/api/ideas');
    expect(r.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'cache-control': 'no-store',
    });
  });
});

describe('/api/network', () => {
  it('só local: não exposto, sem endereços', () => {
    expect(networkInfo('127.0.0.1', 3333, false)).toEqual({
      host: '127.0.0.1',
      port: 3333,
      exposed: false,
      pinEnabled: false,
      urls: [],
    });
  });
  it('0.0.0.0 lista os IPs da rede; IP específico vira a própria URL', () => {
    const all = networkInfo('0.0.0.0', 3333, true);
    expect(all).toMatchObject({ exposed: true, pinEnabled: true });
    for (const u of all.urls) expect(u).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:3333$/);
    expect(networkInfo('192.168.0.9', 4000, false).urls).toEqual(['http://192.168.0.9:4000']);
  });
  it('endpoint reflete o PIN', async () => {
    expect(((await call('GET', '/api/network')).json() as NetworkInfo).pinEnabled).toBe(false);
    await enablePin();
    expect((await call('GET', '/api/network')).statusCode).toBe(401);
  });
});

describe('servir o web compilado', () => {
  let dir: string;
  let web: FastifyInstance;
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-web-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><title>Kortex</title><div id="root"></div>',
    );
    fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    fs.writeFileSync(path.join(dir, 'sw.js'), '// sw');
    web = await buildApp({ db, logger: false, webDir: dir });
  });
  afterEach(async () => {
    await web.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serve index na raiz e nas rotas do React Router; /api e arquivos inexistentes dão 404 real', async () => {
    for (const url of ['/', '/ideias', '/saude?x=1', '/financas/qualquer/coisa']) {
      const r = await web.inject(url);
      expect([url, r.statusCode]).toEqual([url, 200]);
      expect(r.body).toContain('<div id="root">');
    }
    const api = await web.inject('/api/nao-existe');
    expect(api.statusCode).toBe(404);
    expect(api.headers['content-type']).toMatch(/json/);
    expect((await web.inject('/assets/sumiu.js')).statusCode).toBe(404);
    expect((await web.inject({ method: 'POST', url: '/ideias' })).statusCode).toBe(404);
  });

  it('cache: assets com hash são imutáveis; index e service worker sempre revalidam', async () => {
    expect((await web.inject('/assets/app-abc123.js')).headers['cache-control']).toContain(
      'immutable',
    );
    expect((await web.inject('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await web.inject('/')).headers['cache-control']).toBe('no-cache');
  });

  it('a API continua funcionando junto', async () => {
    expect((await web.inject('/api/health')).json().status).toBe('ok');
  });

  it('sem pasta compilada: não serve nada e a API responde normalmente', async () => {
    const none = await buildApp({ db, logger: false, webDir: path.join(dir, 'nao-existe') });
    expect((await none.inject('/ideias')).statusCode).toBe(404);
    expect((await none.inject('/api/health')).statusCode).toBe(200);
    await none.close();
  });
});
