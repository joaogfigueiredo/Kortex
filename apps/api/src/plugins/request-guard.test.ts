import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';
import { buildApp } from '../app';
import { hostAllowed, hostnameOf, isCrossSite, parseHostList } from './request-guard';

describe('hostnameOf', () => {
  it.each([
    ['localhost:3333', 'localhost'],
    ['Localhost', 'localhost'],
    ['[::1]:3333', '::1'],
    ['192.168.0.5:80', '192.168.0.5'],
    ['meu-pc.tail1234.ts.net', 'meu-pc.tail1234.ts.net'],
    [undefined, ''],
  ])('%s → %s', (input, out) => expect(hostnameOf(input)).toBe(out));
});

describe('hostAllowed (barra DNS rebinding)', () => {
  it.each([
    'localhost:3333',
    '127.0.0.1:3333',
    '[::1]:3333',
    '192.168.0.5:3333',
    '100.101.102.103',
    'meu-pc.tail1234.ts.net',
    'notebook.local:3333',
    'app.localhost',
  ])('aceita %s', (h) => expect(hostAllowed(h, [], 'x')).toBe(true));

  it.each([
    'evil.example',
    'evil.example:3333',
    'localhost.evil.example',
    'ts.net.evil.example',
    '',
    undefined,
  ])('recusa %s', (h) => expect(hostAllowed(h, [], 'x')).toBe(false));

  it('aceita o nome da máquina e os domínios liberados (exato e *.sufixo)', () => {
    expect(hostAllowed('DELL-VOSTRO:3333', [], 'dell-vostro')).toBe(true);
    expect(hostAllowed('kortex.casa.com', ['kortex.casa.com'], 'x')).toBe(true);
    expect(hostAllowed('a.casa.com', ['*.casa.com'], 'x')).toBe(true);
    expect(hostAllowed('casa.com', ['*.casa.com'], 'x')).toBe(false);
    expect(hostAllowed('outra.com', ['*.casa.com'], 'x')).toBe(false);
  });

  it('parseHostList limpa espaços, caixa e vazios', () => {
    expect(parseHostList(' A.com, *.B.com ,,')).toEqual(['a.com', '*.b.com']);
    expect(parseHostList(undefined)).toEqual([]);
  });
});

describe('isCrossSite (barra CSRF)', () => {
  it('Sec-Fetch-Site: só same-origin e none passam', () => {
    expect(isCrossSite({ 'sec-fetch-site': 'same-origin' })).toBe(false);
    expect(isCrossSite({ 'sec-fetch-site': 'none' })).toBe(false);
    expect(isCrossSite({ 'sec-fetch-site': 'cross-site' })).toBe(true);
    // outro app em outra porta do mesmo "site" (localhost:8080 → localhost:3333)
    expect(isCrossSite({ 'sec-fetch-site': 'same-site' })).toBe(true);
  });

  it('é o que o navegador viu que vale: atrás de proxy, Host e Origin podem diferir', () => {
    expect(
      isCrossSite({
        'sec-fetch-site': 'same-origin',
        origin: 'http://localhost:5173',
        host: '127.0.0.1:3333',
      }),
    ).toBe(false);
  });

  it('sem Sec-Fetch-Site (navegador antigo): compara Origin com Host e X-Forwarded-Host', () => {
    expect(isCrossSite({ origin: 'http://localhost:3333', host: 'localhost:3333' })).toBe(false);
    expect(
      isCrossSite({
        origin: 'https://pc.ts.net',
        host: '127.0.0.1:3333',
        'x-forwarded-host': 'pc.ts.net',
      }),
    ).toBe(false);
    expect(isCrossSite({ origin: 'https://evil.example', host: 'localhost:3333' })).toBe(true);
    expect(isCrossSite({ origin: 'null', host: 'localhost:3333' })).toBe(true);
    expect(isCrossSite({ origin: 'lixo', host: 'localhost:3333' })).toBe(true);
  });

  it('cliente sem Origin (curl, scripts) não é navegador: passa', () => {
    expect(isCrossSite({ host: 'localhost:3333' })).toBe(false);
  });
});

describe('integração', () => {
  let app: FastifyInstance;
  let close: () => void;
  beforeEach(async () => {
    const conn = openDatabase(':memory:');
    runMigrations(conn.db);
    app = await buildApp({ db: conn.db, logger: false, allowedHosts: ['kortex.casa.com'] });
    close = () => conn.sqlite.close();
  });
  afterEach(async () => {
    await app.close();
    close();
  });

  const post = (headers: Record<string, string>) =>
    app.inject({ method: 'POST', url: '/api/ideas', payload: { title: 'x' }, headers });

  it('pedido do próprio app passa mesmo atrás de proxy (Origin ≠ Host, mas Sec-Fetch-Site: same-origin)', async () => {
    const r = await post({
      host: '127.0.0.1:3399',
      origin: 'http://localhost:5199',
      'sec-fetch-site': 'same-origin',
    });
    expect(r.statusCode).toBe(201);
  });

  it('pedido de outro site é barrado, com ou sem Sec-Fetch-Site', async () => {
    const attempts: Record<string, string>[] = [
      { host: 'localhost:3333', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      { host: 'localhost:3333', origin: 'https://evil.example' },
    ];
    for (const h of attempts) {
      const r = await post(h);
      expect([r.statusCode, r.json().code]).toEqual([403, 'BAD_ORIGIN']);
    }
  });

  it('leituras (GET) de outro site passam pela barra de CSRF; o que protege é o PIN e a falta de CORS', async () => {
    const r = await app.inject({ url: '/api/ideas', headers: { 'sec-fetch-site': 'cross-site' } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('DNS rebinding: Host de domínio desconhecido é recusado em toda a aplicação', async () => {
    for (const url of ['/api/ideas', '/api/health', '/api/export', '/']) {
      const r = await app.inject({ url, headers: { host: 'evil.example:3333' } });
      expect([url, r.statusCode, r.json().code]).toEqual([url, 403, 'BAD_HOST']);
    }
  });

  it('hosts legítimos passam: localhost, IP, Tailscale, nome da máquina e domínio liberado', async () => {
    for (const host of [
      'localhost:3333',
      '127.0.0.1:3333',
      '192.168.0.7:3333',
      'pc.tail1.ts.net',
      `${os.hostname()}:3333`,
      'kortex.casa.com',
    ]) {
      expect([
        host,
        (await app.inject({ url: '/api/health', headers: { host } })).statusCode,
      ]).toEqual([host, 200]);
    }
  });
});
