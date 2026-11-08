import type { FastifyPluginAsync } from 'fastify';
import { idParam, studySubjectCreate, studySubjectUpdate, todayQuery } from '@kortex/shared';
import * as svc from './service';

/**
 * As rotas recebem `?today=YYYY-MM-DD` (o "hoje" local do usuário) para
 * calcular a janela da semana e a sequência sem depender do fuso do servidor.
 */
export const studiesRoutes: FastifyPluginAsync = async (app) => {
  const today = (q: unknown) => todayQuery.parse(q).today;

  app.get('/summary', async (req) => svc.studySummary(app.db, today(req.query)));

  app.get('/', async (req) => svc.listSubjects(app.db, today(req.query)));

  app.post('/', async (req, reply) =>
    reply
      .status(201)
      .send(svc.createSubject(app.db, studySubjectCreate.parse(req.body), today(req.query))),
  );

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return svc.updateSubject(app.db, id, studySubjectUpdate.parse(req.body), today(req.query));
  });

  app.delete('/:id', async (req, reply) => {
    svc.deleteSubject(app.db, idParam.parse(req.params).id);
    return reply.status(204).send();
  });
};
