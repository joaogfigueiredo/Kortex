/**
 * Seed idempotente: só insere dados de exemplo em tabelas vazias.
 * Uso: `npm run db:seed` (roda as migrations antes).
 */
import { count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { openDatabase, type DB } from './client';
import { runMigrations } from './migrate';
import { dailyGoals, mealPlan, reminderCategories, settings, studySubjects } from './schema';

const WEEKDAYS_MON_FRI = 0b0111110; // Seg..Sex

/** Paleta neon das categorias (bolinhas do calendário). */
export const CATEGORY_SEED = [
  { name: 'Trabalho', color: '#6FE3FF' },
  { name: 'Pessoal', color: '#B79CFF' },
  { name: 'Saúde', color: '#4DF5B8' },
  { name: 'Estudos', color: '#FFD166' },
  { name: 'Finanças', color: '#FF8FC7' },
  { name: 'Urgente', color: '#FF6B6B' },
];

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
const isEmpty = (tx: Tx, table: SQLiteTable) =>
  (tx.select({ n: count() }).from(table).get()?.n ?? 0) === 0;

export function seed(db: DB) {
  db.transaction((tx) => {
    tx.insert(settings)
      .values([
        { key: 'theme', value: 'system' },
        { key: 'locale', value: 'pt-BR' },
        { key: 'week_start', value: '0' },
      ])
      .onConflictDoNothing()
      .run();

    if (isEmpty(tx, reminderCategories)) {
      tx.insert(reminderCategories).values(CATEGORY_SEED).run();
    }

    if (isEmpty(tx, dailyGoals)) {
      tx.insert(dailyGoals)
        .values([
          { title: 'Beber 2L de água', icon: 'droplet', position: 1 },
          { title: 'Estudar 1h', icon: 'book-open', weekdays: WEEKDAYS_MON_FRI, position: 2 },
          { title: 'Treinar', icon: 'dumbbell', weekdays: 0b0101010, position: 3 }, // Seg/Qua/Sex
          { title: 'Revisar agenda de amanhã', icon: 'calendar-check', position: 4 },
        ])
        .run();
    }

    if (isEmpty(tx, mealPlan)) {
      tx.insert(mealPlan)
        .values([
          { name: 'Café da manhã', time: '07:30', position: 1 },
          { name: 'Almoço', time: '12:30', position: 2 },
          { name: 'Lanche', time: '16:00', position: 3 },
          { name: 'Jantar', time: '20:00', position: 4 },
        ])
        .run();
    }

    if (isEmpty(tx, studySubjects)) {
      tx.insert(studySubjects)
        .values([{ name: 'Exemplo: TypeScript', level: 'intermediate', progress: 40 }])
        .run();
    }
  });
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('db/seed.ts')) {
  const { db, sqlite } = openDatabase();
  runMigrations(db);
  seed(db);
  sqlite.close();
  console.log('✔ Seed concluído');
}
