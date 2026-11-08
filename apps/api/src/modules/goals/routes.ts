import type { FastifyPluginAsync } from 'fastify';
import {
  dailyGoalCreate,
  dailyGoalUpdate,
  dateQuery,
  goalCheckBody,
  goalCheckParams,
  idParam,
  todayQuery,
} from '@kortex/shared';
import * as svc from './service';

/** /api/goals — metas diárias recorrentes */
export const goalsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => svc.listGoals(app.db));
  app.get('/day', async (req) => svc.goalsOfDay(app.db, dateQuery.parse(req.query).date));
  app.get('/summary', async (req) => svc.goalsSummary(app.db, todayQuery.parse(req.query).today));

  app.post('/', async (req, reply) =>
    reply.status(201).send(svc.createGoal(app.db, dailyGoalCreate.parse(req.body))),
  );
  app.patch('/:id', async (req) =>
    svc.updateGoal(app.db, idParam.parse(req.params).id, dailyGoalUpdate.parse(req.body)),
  );
  app.delete('/:id', async (req, reply) => {
    svc.deleteGoal(app.db, idParam.parse(req.params).id);
    return reply.status(204).send();
  });

  app.put('/:id/checks/:date', async (req) => {
    const { id, date } = goalCheckParams.parse(req.params);
    return svc.setGoalCheck(app.db, id, date, goalCheckBody.parse(req.body).done);
  });
};
