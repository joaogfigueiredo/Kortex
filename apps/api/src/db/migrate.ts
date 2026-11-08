import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DB_PATH } from '../env';
import { openDatabase, type DB } from './client';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export function runMigrations(db: DB) {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

// Execução direta: `npm run db:migrate`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { db, sqlite } = openDatabase();
  runMigrations(db);
  sqlite.close();
  console.log(`✔ Migrations aplicadas em ${DB_PATH}`);
}
