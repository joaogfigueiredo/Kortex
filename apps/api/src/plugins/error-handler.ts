import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** Erro de domínio com status HTTP explícito. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} não encontrado`);

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados inválidos', issues: err.issues });
    }
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message, details: err.details });
    }
    const e = err as { code?: string; statusCode?: number; message: string };
    // Violação de CHECK / FK / UNIQUE do SQLite
    if (typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
      return reply.status(409).send({ error: 'Restrição do banco violada', code: e.code });
    }
    if (e.statusCode && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: e.message });
    }
    req.log.error(err);
    return reply.status(500).send({ error: 'Erro interno' });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: `Rota ${req.method} ${req.url} não existe` });
  });
}
