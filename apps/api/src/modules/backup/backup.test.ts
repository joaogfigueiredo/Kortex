import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { unzipSync, strFromU8 } from 'fflate';
import type { BackupFile, BackupInfo, ImportResult } from '@kortex/shared';
import { openDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrate';
import { seed } from '../../db/seed';
import { buildApp } from '../../app';
import { autoBackup, csvCell, listBackups } from './service';

let app: FastifyInstance;
let close: () => void;
let dir: string;
let sqlite: Database.Database;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-bkp-'));
  const conn = openDatabase(':memory:');
  sqlite = conn.sqlite;
  runMigrations(conn.db);
  seed(conn.db);
  app = await buildApp({ db: conn.db, logger: false, backupDir: dir });
  close = () => conn.sqlite.close();
});
afterEach(async () => {
  await app.close();
  close();
  fs.rmSync(dir, { recursive: true, force: true });
});

type M = 'GET' | 'POST' | 'PUT' | 'DELETE';
const req = (method: M, url: string, payload?: object) =>
  app.inject({ method, url: '/api' + url, payload });
const exportJson = async () => (await req('GET', '/export?format=json')).json() as BackupFile;

async function fill() {
  const idea = (await req('POST', '/ideas', { title: 'Ideia, com "aspas"\ne quebra' })).json();
  const p = (
    await req('POST', '/projects', { title: 'Kortex', status: 'development', devLevel: 2 })
  ).json();
  await req('POST', `/ideas/${idea.id}/promote`);
  const f = (
    await req('POST', '/finance', { title: 'CLT', status: 'active', actualMonthlyCents: 500000 })
  ).json();
  await req('POST', `/finance/${f.id}/entries`, { type: 'alert', content: 'Holerite' });
  await req('POST', '/time', {
    module: 'project',
    refId: p.id,
    startedAt: '2026-11-08T10:00',
    durationSec: 600,
  });
}

describe('csvCell', () => {
  it('escapa vírgulas, aspas e quebras de linha (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe('exportação', () => {
  it('JSON: formato, versão, todas as tabelas e download', async () => {
    await fill();
    const res = await req('GET', '/export?format=json');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="kortex-backup-\d{4}-\d{2}-\d{2}\.json"/,
    );
    const b = res.json() as BackupFile;
    expect(b).toMatchObject({ format: 'kortex-backup', version: 1 });
    expect(b.schemaVersion).toBeGreaterThan(0);
    expect(Object.keys(b.tables)).toContain('ideas');
    expect(Object.keys(b.tables)).not.toContain('__drizzle_migrations');
    expect(b.tables.ideas![0]).toHaveProperty('promoted_project_id'); // nomes do banco (snake_case)
  });

  it('CSV: zip com um CSV por tabela + manifest', async () => {
    await fill();
    const res = await req('GET', '/export?format=csv');
    expect(res.headers['content-type']).toBe('application/zip');
    const files = unzipSync(new Uint8Array(res.rawPayload));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['ideas.csv', 'projects.csv', 'manifest.json']),
    );
    expect([...files['ideas.csv']!.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 p/ Excel
    const ideas = strFromU8(files['ideas.csv']!);
    expect(ideas).toContain('"Ideia, com ""aspas""\ne quebra"');
    expect(JSON.parse(strFromU8(files['manifest.json']!)).rows.ideas).toBe(1);
  });
});

describe('importação', () => {
  it('ida e volta: exportar → apagar → importar devolve os mesmos dados', async () => {
    await fill();
    const before = await exportJson();
    await req('DELETE', '/ideas/1');
    await req('POST', '/ideas', { title: 'lixo' });
    const res = await req('POST', '/import', before);
    expect(res.statusCode).toBe(200);
    const result = res.json() as ImportResult;
    expect(result.safetyBackup).toMatch(/^kortex-pre-import-/);
    expect(fs.existsSync(path.join(dir, result.safetyBackup))).toBe(true);
    const after = await exportJson();
    expect(after.tables).toEqual(before.tables);
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1); // FK religadas
  });

  it('rejeita arquivo que não é backup e tabelas desconhecidas', async () => {
    expect((await req('POST', '/import', { foo: 1 })).statusCode).toBe(400);
    const b = await exportJson();
    const bad = { ...b, tables: { ...b.tables, hackers: [] } };
    expect((await req('POST', '/import', bad)).statusCode).toBe(400);
  });

  it('backup com referência quebrada: desfaz tudo (transação)', async () => {
    await fill();
    const b = await exportJson();
    const countBefore = (await exportJson()).tables.ideas!.length;
    const broken = structuredClone(b);
    broken.tables.finance_entries![0]!.activity_id = 999; // FK inexistente
    broken.tables.ideas = [];
    const res = await req('POST', '/import', broken);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/referência/);
    expect((await exportJson()).tables.ideas!.length).toBe(countBefore); // nada mudou
  });

  it('colunas desconhecidas são ignoradas (compatibilidade entre versões)', async () => {
    const b = await exportJson();
    b.tables.ideas = [
      { id: 1, title: 'Do futuro', status: 'organized', priority: 2, position: 1, campo_novo: 'x' },
    ];
    expect((await req('POST', '/import', b)).statusCode).toBe(200);
    expect((await exportJson()).tables.ideas![0]).toMatchObject({ title: 'Do futuro' });
  });
});

describe('backups .db', () => {
  it('criar, listar, baixar e excluir; o arquivo é um SQLite válido', async () => {
    await fill();
    const created = (await req('POST', '/backups')).json() as BackupInfo;
    expect(created.name).toMatch(/^kortex-manual-.*\.db$/);
    const list = (await req('GET', '/backups')).json() as BackupInfo[];
    expect(list[0]!.name).toBe(created.name);
    const copy = new Database(path.join(dir, created.name), { readonly: true });
    expect((copy.prepare('select count(*) n from projects').get() as { n: number }).n).toBe(2);
    copy.close();
    const dl = await req('GET', `/backups/${created.name}`);
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.subarray(0, 15).toString()).toBe('SQLite format 3');
    expect((await req('DELETE', `/backups/${created.name}`)).statusCode).toBe(204);
  });

  it('dois backups no mesmo instante não colidem', async () => {
    const [a, b] = await Promise.all([req('POST', '/backups'), req('POST', '/backups')]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    expect(a.json().name).not.toBe(b.json().name);
  });

  it('bloqueia nomes perigosos (path traversal)', async () => {
    expect((await req('GET', '/backups/..%2F..%2Fkortex.db')).statusCode).toBe(400);
    expect((await req('GET', '/backups/kortex-x.db')).statusCode).toBe(404);
  });

  it('automático: no máximo 1 por janela e rotação dos antigos', () => {
    expect(autoBackup(sqlite, dir)).not.toBeNull();
    expect(autoBackup(sqlite, dir)).toBeNull(); // dentro da janela
    for (let i = 0; i < 4; i++) autoBackup(sqlite, dir, { minHours: 0, keep: 3 });
    expect(
      listBackups(dir).filter((b) => b.name.startsWith('kortex-auto-')).length,
    ).toBeLessThanOrEqual(3);
  });
});
