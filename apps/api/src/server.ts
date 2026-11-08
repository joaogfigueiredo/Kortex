import { buildApp } from './app';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';
import { DB_PATH, HOST, PORT } from './env';

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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
