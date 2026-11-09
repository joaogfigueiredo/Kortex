import Fastify from 'fastify';
import fs from 'node:fs';
import fastifyStatic from '@fastify/static';
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
import { authRoutes } from './modules/auth/routes';
import { createLimiter, isAuthenticated, pinEnabled } from './modules/auth/service';
import { networkInfo } from './modules/network/service';
import { BACKUP_DIR, DB_PATH, HOST, PORT, SERVE_WEB, WEB_DIR } from './env';
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
  /** Pasta do web compilado a servir (null = não servir). Padrão: só em produção. */
  webDir?: string | null;
  /** Endereço/porta em que o servidor escuta (informativo, para /api/network). */
  network?: { host: string; port: number };
}

/** Rotas liberadas mesmo com PIN ativo (precisam existir para a tela de bloqueio). */
const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/auth/status',
  'POST /api/auth/login',
  'POST /api/auth/logout',
]);

/** A origem da requisição é a mesma do servidor? (barra CSRF e páginas de terceiros) */
function sameOrigin(origin: string, host: string | undefined) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // "null" e valores inválidos
  }
}

export async function buildApp({
  db,
  logger = true,
  backupDir = BACKUP_DIR,
  webDir = SERVE_WEB ? WEB_DIR : null,
  network = { host: HOST, port: PORT },
}: AppOptions) {
  const serveWeb = !!webDir && fs.existsSync(path.join(webDir, 'index.html'));
  const limiter = createLimiter();
  const app = Fastify({
    logger: logger && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  });

  app.decorate('db', db);
  registerErrorHandler(app, { spa: serveWeb });

  // O web é sempre servido pela mesma origem da API (proxy do Vite em dev, API em produção),
  // por isso NÃO há CORS: páginas de outros sites não conseguem ler as respostas.
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/')) return;
    // Pedidos que alteram dados só valem se vierem do próprio Kortex (barra CSRF).
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !sameOrigin(origin, req.headers.host))
        return reply.status(403).send({ error: 'Origem não permitida', code: 'BAD_ORIGIN' });
    }
    if (PUBLIC_ROUTES.has(`${req.method} ${url}`)) return;
    if (pinEnabled(db) && !isAuthenticated(db, req))
      return reply.status(401).send({ error: 'Autenticação necessária', code: 'AUTH_REQUIRED' });
  });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    // Dados da API nunca são guardados em cache (navegador, proxies, service worker).
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  if (serveWeb) {
    await app.register(fastifyStatic, {
      root: webDir,
      wildcard: false,
      setHeaders(res, filePath) {
        const f = filePath.split('\\').join('/'); // Windows usa "\" nos caminhos
        // Arquivos com hash no nome nunca mudam; o resto sempre revalida (atualizações chegam na hora).
        res.header(
          'Cache-Control',
          f.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

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

  app.get('/api/network', async () => networkInfo(network.host, network.port, pinEnabled(db)));

  await app.register(authRoutes, { prefix: '/api/auth', limiter });
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
