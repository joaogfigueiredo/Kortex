import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { loginBody, pinRemoveBody, pinSetBody } from '@kortex/shared';
import { HttpError } from '../../plugins/error-handler';
import * as svc from './service';

/** /api/auth — PIN opcional para quando o Kortex é acessado por outros dispositivos. */
export const authRoutes: FastifyPluginAsync<{ limiter: svc.Limiter }> = async (
  app,
  { limiter },
) => {
  const key = (req: FastifyRequest) => req.socket.remoteAddress ?? 'unknown';

  /** Confere o PIN respeitando o limite de tentativas. */
  async function checkPin(req: FastifyRequest, reply: FastifyReply, pin: string) {
    const wait = limiter.retryAfter(key(req));
    if (wait) {
      reply.header('Retry-After', String(wait));
      throw new HttpError(429, `Muitas tentativas. Aguarde ${wait}s e tente de novo.`);
    }
    if (!(await svc.verifyPin(app.db, pin))) {
      limiter.fail(key(req));
      throw new HttpError(401, 'PIN incorreto');
    }
    limiter.success(key(req));
  }

  const issue = (req: FastifyRequest, reply: FastifyReply) =>
    reply.header('Set-Cookie', svc.sessionCookie(svc.makeToken(app.db), svc.isSecure(req)));

  app.get('/status', async (req) => svc.status(app.db, req));

  app.post('/login', async (req, reply) => {
    const { pin } = loginBody.parse(req.body);
    if (!svc.pinEnabled(app.db)) return { ok: true };
    await checkPin(req, reply, pin);
    issue(req, reply);
    return { ok: true };
  });

  app.post('/logout', async (req, reply) => {
    reply.header('Set-Cookie', svc.clearCookie(svc.isSecure(req)));
    return { ok: true };
  });

  /** Define o PIN (1ª vez) ou troca. A sessão atual continua válida; as outras caem. */
  app.post('/pin', async (req, reply) => {
    const { pin, currentPin } = pinSetBody.parse(req.body);
    if (svc.pinEnabled(app.db)) {
      if (!currentPin) throw new HttpError(400, 'Informe o PIN atual');
      await checkPin(req, reply, currentPin);
    }
    await svc.setPin(app.db, pin);
    issue(req, reply);
    return { ok: true };
  });

  app.post('/pin/remove', async (req, reply) => {
    const { currentPin } = pinRemoveBody.parse(req.body);
    if (!svc.pinEnabled(app.db)) return { ok: true };
    await checkPin(req, reply, currentPin);
    svc.removePin(app.db);
    reply.header('Set-Cookie', svc.clearCookie(svc.isSecure(req)));
    return { ok: true };
  });
};
