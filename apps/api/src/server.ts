import { buildApp } from './app';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';
import { AUTO_BACKUP, BACKUP_DIR, DB_PATH, HOST, PORT, SERVE_WEB } from './env';
import { pinEnabled } from './modules/auth/service';
import { networkInfo } from './modules/network/service';
import { autoBackup } from './modules/backup/service';

const { db, sqlite } = openDatabase();
runMigrations(db);
seed(db);

const app = await buildApp({ db });

const shutdown = async () => {
  await app.close();
  sqlite.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Banco: ${DB_PATH}`);
  const net = networkInfo(HOST, PORT, pinEnabled(db));
  if (SERVE_WEB) app.log.info(`Abra no navegador: http://localhost:${PORT}`);
  if (net.exposed) {
    for (const u of net.urls) app.log.info(`Na rede local: ${u}`);
    if (!net.pinEnabled)
      app.log.warn('Servidor acessível pela rede SEM PIN. Defina um em Configurações → Segurança.');
  }
  if (AUTO_BACKUP) {
    try {
      const b = autoBackup(sqlite, BACKUP_DIR);
      if (b) app.log.info(`Backup automático: ${b.name}`);
    } catch (e) {
      app.log.warn({ err: e }, 'Backup automático falhou (o app continua normalmente)');
    }
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
