import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import type { DB } from './db/client';
import { registerErrorHandler } from './plugins/error-handler';

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

  // Módulos de domínio serão registrados aqui (Passos 3+):
  // await app.register(ideasRoutes, { prefix: '/api/ideas' });

  return app;
}
