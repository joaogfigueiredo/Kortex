import { defineConfig } from 'drizzle-kit';
import { DB_PATH } from './src/env';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: DB_PATH },
  strict: true,
  verbose: true,
});
