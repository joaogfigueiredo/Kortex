import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import type { DB } from './db/client';
import { registerErrorHandler } from './plugins/error-handler';
import { settingsRoutes } from './modules/settings/routes';
import { ideasRoutes } from './modules/ideas/routes';
import { projectsRoutes } from './modules/projects/routes';
import { financeRoutes } from './modules/finance/routes';
import { remindersRoutes } from './modules/reminders/routes';
import { timeRoutes } from './modules/time/routes';
import { studiesRoutes } from './modules/studies/routes';
import { mealsRoutes, wellnessRoutes, workoutsRoutes } from './modules/health/routes';
import { goalsRoutes } from './modules/goals/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { backupRoutes } from './modules/backup/routes';
import { BACKUP_DIR, DB_PATH } from './env';
import path from 'node:path';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
  }
}

export interface AppOptions {
  db: DB;
  logger?: boolean;
  /** Pasta dos backups .db (padrão: data/backups). */
  backupDir?: string;
}

export async function buildApp({ db, logger = true, backupDir = BACKUP_DIR }: AppOptions) {
  const app = Fastify({
    logger: logger && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  });

  app.decorate('db', db);
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  app.get('/api/health', async () => {
    const row = db.get<{ v: string }>(sql`select sqlite_version() as v`);
    // `db` (nome do arquivo) ajuda a confirmar qual banco está servindo esta instância.
    return {
      status: 'ok',
      sqlite: row.v,
      db: path.basename(DB_PATH),
      time: new Date().toISOString(),
    };
  });

  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(ideasRoutes, { prefix: '/api/ideas' });
  await app.register(projectsRoutes, { prefix: '/api/projects' });
  await app.register(financeRoutes, { prefix: '/api/finance' });
  await app.register(remindersRoutes, { prefix: '/api/reminders' });
  await app.register(timeRoutes, { prefix: '/api/time' });
  await app.register(studiesRoutes, { prefix: '/api/studies' });
  await app.register(workoutsRoutes, { prefix: '/api/workouts' });
  await app.register(mealsRoutes, { prefix: '/api/meals' });
  await app.register(wellnessRoutes, { prefix: '/api/wellness' });
  await app.register(goalsRoutes, { prefix: '/api/goals' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(backupRoutes, { prefix: '/api', backupDir });

  return app;
}
