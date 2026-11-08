import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { strToU8, zipSync } from 'fflate';
import type { BackupFile, BackupInfo, ImportResult } from '@kortex/shared';
import { HttpError } from '../../plugins/error-handler';

type Sqlite = Database.Database;

/**
 * Ordem de inserção respeitando as chaves estrangeiras (pais antes de filhos).
 * Tabelas novas que não estejam aqui entram no fim, em ordem alfabética.
 */
const FK_ORDER = [
  'settings',
  'tags',
  'projects',
  'ideas',
  'entity_tags',
  'reminder_categories',
  'reminders',
  'reminder_completions',
  'finance_activities',
  'finance_entries',
  'study_subjects',
  'time_entries',
  'workouts',
  'meal_plan',
  'meal_logs',
  'daily_goals',
  'goal_checks',
];

/** Tabelas de dados do usuário (exclui internas do SQLite e do Drizzle). */
export function dataTables(sqlite: Sqlite): string[] {
  const names = (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
  const known = FK_ORDER.filter((t) => names.includes(t));
  return [...known, ...names.filter((n) => !FK_ORDER.includes(n)).sort()];
}

const columnsOf = (sqlite: Sqlite, table: string) =>
  (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);

function schemaVersion(sqlite: Sqlite) {
  try {
    return (sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number })
      .n;
  } catch {
    return 0;
  }
}

// ---------- Exportação ----------

export function exportJson(sqlite: Sqlite): BackupFile {
  const tables: BackupFile['tables'] = {};
  for (const t of dataTables(sqlite))
    tables[t] = sqlite.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[];
  return {
    format: 'kortex-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    schemaVersion: schemaVersion(sqlite),
    tables,
  };
}

/** Valor de célula CSV (RFC 4180): aspas quando há vírgula, aspas ou quebra de linha. */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ZIP com um CSV por tabela (UTF-8 com BOM, abre certo no Excel) + manifest.json. */
export function exportCsvZip(sqlite: Sqlite): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const manifest: Record<string, number> = {};
  for (const t of dataTables(sqlite)) {
    const cols = columnsOf(sqlite, t);
    const rows = sqlite.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[];
    const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))];
    files[`${t}.csv`] = strToU8('﻿' + lines.join('\r\n') + '\r\n');
    manifest[t] = rows.length;
  }
  files['manifest.json'] = strToU8(
    JSON.stringify(
      {
        format: 'kortex-csv',
        exportedAt: new Date().toISOString(),
        schemaVersion: schemaVersion(sqlite),
        rows: manifest,
      },
      null,
      2,
    ),
  );
  return zipSync(files, { level: 6 });
}

// ---------- Backups .db ----------

const BACKUP_RE = /^kortex-[\w-]+\.db$/;
/** 2026-11-08_20-41-18-123 (com milissegundos: dois backups no mesmo segundo não colidem). */
const stamp = (d = new Date()) =>
  d.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 23);

/** Cópia consistente do banco (VACUUM INTO funciona com o app rodando, em WAL). */
export function createBackup(sqlite: Sqlite, dir: string, label = 'manual'): BackupInfo {
  fs.mkdirSync(dir, { recursive: true });
  const base = `kortex-${label}-${stamp()}`;
  let name = `${base}.db`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}-${i}.db`;
  const file = path.join(dir, name);
  sqlite.prepare('VACUUM INTO ?').run(file);
  const st = fs.statSync(file);
  return { name, size: st.size, createdAt: st.mtime.toISOString() };
}

export function listBackups(dir: string): BackupInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => BACKUP_RE.test(n))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name));
}

/** Caminho seguro de um backup pelo nome (impede "../" etc.). */
export function backupPath(dir: string, name: string) {
  if (!BACKUP_RE.test(name) || path.basename(name) !== name)
    throw new HttpError(400, 'Nome de backup inválido');
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new HttpError(404, 'Backup não encontrado');
  return file;
}

/** Mantém só os `keep` backups mais recentes de um rótulo (ex.: "auto"). */
export function rotateBackups(dir: string, label: string, keep: number) {
  const mine = listBackups(dir).filter((b) => b.name.startsWith(`kortex-${label}-`));
  for (const b of mine.slice(keep)) fs.rmSync(path.join(dir, b.name), { force: true });
}

/** Backup automático: no máximo 1 a cada `minHours`, guardando os `keep` mais recentes. */
export function autoBackup(sqlite: Sqlite, dir: string, { minHours = 20, keep = 7 } = {}) {
  const last = listBackups(dir).find((b) => b.name.startsWith('kortex-auto-'));
  if (last && Date.now() - new Date(last.createdAt).getTime() < minHours * 3600_000) return null;
  const info = createBackup(sqlite, dir, 'auto');
  rotateBackups(dir, 'auto', keep);
  return info;
}

// ---------- Importação (restaurar de JSON) ----------

export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (
    !d ||
    d.format !== 'kortex-backup' ||
    d.version !== 1 ||
    typeof d.tables !== 'object' ||
    !d.tables
  )
    throw new HttpError(400, 'Arquivo não é um backup do Kortex (formato inválido)');
  for (const [t, rows] of Object.entries(d.tables))
    if (!Array.isArray(rows)) throw new HttpError(400, `Tabela "${t}" inválida no backup`);
  return d as BackupFile;
}

/**
 * Substitui TODOS os dados pelos do backup, numa transação única.
 * Antes, salva um .db de segurança. Colunas desconhecidas são ignoradas
 * (backups de versões futuras/antigas continuam importáveis).
 */
export function importBackup(sqlite: Sqlite, data: unknown, backupDir: string): ImportResult {
  const file = validateBackup(data);
  const tables = dataTables(sqlite);
  const unknown = Object.keys(file.tables).filter((t) => !tables.includes(t));
  if (unknown.length)
    throw new HttpError(400, `Tabelas desconhecidas no backup: ${unknown.join(', ')}`);

  const safety = createBackup(sqlite, backupDir, 'pre-import');
  const counts: Record<string, number> = {};

  // foreign_keys só pode mudar fora de transação; checamos tudo no fim.
  sqlite.pragma('foreign_keys = OFF');
  try {
    sqlite.transaction(() => {
      for (const t of [...tables].reverse()) sqlite.prepare(`DELETE FROM "${t}"`).run();
      for (const t of tables) {
        const rows = file.tables[t] ?? [];
        const cols = columnsOf(sqlite, t);
        for (const row of rows) {
          const keys = Object.keys(row).filter((k) => cols.includes(k));
          if (!keys.length) continue;
          sqlite
            .prepare(
              `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
            )
            .run(
              ...keys.map((k) => {
                const v = row[k];
                return typeof v === 'boolean'
                  ? Number(v)
                  : v !== null && typeof v === 'object'
                    ? JSON.stringify(v)
                    : v;
              }),
            );
        }
        counts[t] = rows.length;
      }
      const broken = sqlite.pragma('foreign_key_check') as unknown[];
      if (broken.length)
        throw new HttpError(
          400,
          `Backup inconsistente: ${broken.length} referência(s) quebrada(s)`,
        );
    })();
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
  return { safetyBackup: safety.name, counts };
}
