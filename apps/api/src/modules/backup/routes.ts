import fs from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as svc from './service';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * /api/export, /api/import e /api/backups.
 * `backupDir` vem das opções do app (pasta data/backups por padrão).
 */
export const backupRoutes: FastifyPluginAsync<{ backupDir: string }> = async (
  app,
  { backupDir },
) => {
  const sqlite = () => app.db.$client;

  app.get('/export', async (req, reply) => {
    const { format } = z
      .object({ format: z.enum(['json', 'csv']).default('json') })
      .parse(req.query);
    if (format === 'json') {
      return reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="kortex-backup-${today()}.json"`)
        .send(JSON.stringify(svc.exportJson(sqlite()), null, 2));
    }
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="kortex-csv-${today()}.zip"`)
      .send(Buffer.from(svc.exportCsvZip(sqlite())));
  });

  // Restaurar a partir de um backup JSON (arquivos grandes: limite de 100 MB).
  app.post('/import', { bodyLimit: 100 * 1024 * 1024 }, async (req) =>
    svc.importBackup(sqlite(), req.body, backupDir),
  );

  app.get('/backups', async () => svc.listBackups(backupDir));

  app.post('/backups', async (_req, reply) =>
    reply.status(201).send(svc.createBackup(sqlite(), backupDir)),
  );

  app.get('/backups/:name', async (req, reply) => {
    const { name } = z.object({ name: z.string() }).parse(req.params);
    const file = svc.backupPath(backupDir, name);
    return reply
      .header('Content-Type', 'application/vnd.sqlite3')
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .send(fs.createReadStream(file));
  });

  app.delete('/backups/:name', async (req, reply) => {
    const { name } = z.object({ name: z.string() }).parse(req.params);
    fs.rmSync(svc.backupPath(backupDir, name));
    return reply.status(204).send();
  });
};
