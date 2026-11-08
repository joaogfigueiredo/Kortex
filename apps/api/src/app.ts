import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import type { DB } from './db/client';
import { registerErrorHandler } from './plugins/error-handler';
import { settingsRoutes } from './modules/settings/routes';
import { ideasRoutes } from './modules/ideas/routes';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
  }
}

export interface AppOptions {
  db: DB;
  logger?: boolean;
}

export async function buildApp({ db, logger = true }: AppOptions) {
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
    return { status: 'ok', sqlite: row.v, time: new Date().toISOString() };
  });

  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(ideasRoutes, { prefix: '/api/ideas' });
  // Próximos módulos (Passos 4+): projects, finance, reminders...

  return app;
}
