import type { FastifyPluginAsync } from 'fastify';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { settings } from '../../db/schema';
import { HttpError } from '../../plugins/error-handler';

/**
 * Preferências públicas (chave/valor). Chaves sensíveis como `pin_hash`
 * ficam fora da whitelist e nunca são expostas por aqui.
 */
const PUBLIC_SETTINGS = {
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.string().min(2).max(10),
  week_start: z.enum(['0', '1']),
} as const;
type PublicKey = keyof typeof PUBLIC_SETTINGS;
const PUBLIC_KEYS = Object.keys(PUBLIC_SETTINGS) as PublicKey[];

const isPublicKey = (k: string): k is PublicKey => k in PUBLIC_SETTINGS;

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    const rows = app.db.select().from(settings).where(inArray(settings.key, PUBLIC_KEYS)).all();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put('/:key', async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    if (!isPublicKey(key)) throw new HttpError(404, `Configuração "${key}" não existe`);
    const { value } = z.object({ value: PUBLIC_SETTINGS[key] }).parse(req.body);
    app.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
    return { key, value };
  });
};
