import type { FastifyPluginAsync } from 'fastify';
import {
  dateQuery,
  idParam,
  mealLogBody,
  mealLogParams,
  mealPlanCreate,
  mealPlanUpdate,
  todayQuery,
  workoutCreate,
  workoutQuery,
  workoutUpdate,
} from '@kortex/shared';
import * as svc from './service';

/** /api/workouts — treinos */
export const workoutsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => svc.listWorkouts(app.db, workoutQuery.parse(req.query)));
  app.get('/types', async () => svc.workoutTypes(app.db));
  app.post('/', async (req, reply) =>
    reply.status(201).send(svc.createWorkout(app.db, workoutCreate.parse(req.body))),
  );
  app.patch('/:id', async (req) =>
    svc.updateWorkout(app.db, idParam.parse(req.params).id, workoutUpdate.parse(req.body)),
  );
  app.delete('/:id', async (req, reply) => {
    svc.deleteWorkout(app.db, idParam.parse(req.params).id);
    return reply.status(204).send();
  });
};

/** /api/meals — plano de refeições e marcações diárias */
export const mealsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => svc.listMeals(app.db));
  app.post('/', async (req, reply) =>
    reply.status(201).send(svc.createMeal(app.db, mealPlanCreate.parse(req.body))),
  );
  app.patch('/:id', async (req) =>
    svc.updateMeal(app.db, idParam.parse(req.params).id, mealPlanUpdate.parse(req.body)),
  );
  app.delete('/:id', async (req, reply) => {
    svc.deleteMeal(app.db, idParam.parse(req.params).id);
    return reply.status(204).send();
  });

  app.put('/:id/logs/:date', async (req) => {
    const { id, date } = mealLogParams.parse(req.params);
    const { status, note } = mealLogBody.parse(req.body);
    return svc.setMealLog(app.db, id, date, status, note);
  });
  app.delete('/:id/logs/:date', async (req, reply) => {
    const { id, date } = mealLogParams.parse(req.params);
    svc.clearMealLog(app.db, id, date);
    return reply.status(204).send();
  });
};

/** /api/wellness — visões combinadas (dia e resumo semanal) */
export const wellnessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/day', async (req) => svc.wellnessDay(app.db, dateQuery.parse(req.query).date));
  app.get('/summary', async (req) =>
    svc.wellnessSummary(app.db, todayQuery.parse(req.query).today),
  );
};
