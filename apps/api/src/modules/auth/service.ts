import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { AuthStatus } from '@kortex/shared';
import type { DB } from '../../db/client';
import { settings } from '../../db/schema';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const COOKIE_NAME = 'kortex_session';
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

// ---------- settings (chave/valor) ----------
const get = (db: DB, key: string) =>
  db.select().from(settings).where(eq(settings.key, key)).get()?.value;
const set = (db: DB, key: string, value: string) =>
  db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
const del = (db: DB, key: string) => db.delete(settings).where(eq(settings.key, key)).run();

// ---------- PIN ----------
export const pinEnabled = (db: DB) => get(db, 'pin_hash') != null;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPin(db: DB, pin: string): Promise<boolean> {
  const stored = get(db, 'pin_hash');
  if (!stored) return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(pin, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Define/troca o PIN e invalida todas as sessões abertas (novo segredo). */
export async function setPin(db: DB, pin: string) {
  set(db, 'pin_hash', await hashPin(pin));
  set(db, 'pin_numeric', /^\d+$/.test(pin) ? '1' : '0');
  rotateSecret(db);
}

export function removePin(db: DB) {
  del(db, 'pin_hash');
  del(db, 'pin_numeric');
  del(db, 'session_secret');
}

// ---------- sessão (cookie assinado) ----------
function secret(db: DB): string {
  let s = get(db, 'session_secret');
  if (!s) {
    s = randomBytes(32).toString('hex');
    set(db, 'session_secret', s);
  }
  return s;
}
const rotateSecret = (db: DB) => set(db, 'session_secret', randomBytes(32).toString('hex'));

const sign = (db: DB, exp: number) =>
  createHmac('sha256', secret(db)).update(String(exp)).digest('base64url');

export const makeToken = (db: DB, now = Date.now()) => {
  const exp = now + SESSION_TTL_MS;
  return `${exp}.${sign(db, exp)}`;
};

export function verifyToken(db: DB, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp <= now) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(db, exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readCookie(req: FastifyRequest, name = COOKIE_NAME): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export const isAuthenticated = (db: DB, req: FastifyRequest) =>
  !pinEnabled(db) || verifyToken(db, readCookie(req));

/** `Secure` só quando a conexão é HTTPS (direta ou via proxy como o Tailscale Serve). */
export const isSecure = (req: FastifyRequest) =>
  req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';

export const sessionCookie = (token: string, secure: boolean) =>
  `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`;

export const clearCookie = (secure: boolean) =>
  `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;

export function status(db: DB, req: FastifyRequest): AuthStatus {
  return {
    pinEnabled: pinEnabled(db),
    numeric: get(db, 'pin_numeric') === '1',
    authenticated: isAuthenticated(db, req),
  };
}

// ---------- proteção contra tentativas em sequência ----------
/**
 * Após 5 erros seguidos, trava por 30 s e dobra a cada novo erro (máx. 15 min).
 * Chave = endereço do socket (atrás de um proxy local como o Tailscale Serve,
 * todos chegam como 127.0.0.1 e o limite vira global — o que é aceitável aqui).
 */
export function createLimiter(now: () => number = Date.now) {
  const state = new Map<string, { fails: number; lockedUntil: number }>();
  return {
    /** Segundos restantes de bloqueio (0 = liberado). */
    retryAfter(key: string) {
      const s = state.get(key);
      return s && s.lockedUntil > now() ? Math.ceil((s.lockedUntil - now()) / 1000) : 0;
    },
    fail(key: string) {
      const s = state.get(key) ?? { fails: 0, lockedUntil: 0 };
      s.fails++;
      if (s.fails >= 5) s.lockedUntil = now() + Math.min(15 * 60_000, 30_000 * 2 ** (s.fails - 5));
      state.set(key, s);
    },
    success(key: string) {
      state.delete(key);
    },
  };
}
export type Limiter = ReturnType<typeof createLimiter>;
