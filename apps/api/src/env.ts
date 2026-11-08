import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Raiz do monorepo (apps/api/src -> ../../..). */
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const DATA_DIR = process.env.KORTEX_DATA_DIR ?? path.join(ROOT_DIR, 'data');
export const DB_PATH = process.env.KORTEX_DB_PATH ?? path.join(DATA_DIR, 'kortex.db');

export const PORT = Number(process.env.PORT ?? 3333);
/** 127.0.0.1 por padrão; use HOST=0.0.0.0 para acessar pelo celular na rede local. */
export const HOST = process.env.HOST ?? '127.0.0.1';
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
