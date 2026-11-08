import type { FastifyPluginAsync } from 'fastify';
import {
  idParam,
  occurrenceDateParam,
  occurrenceRange,
  occurrenceToggle,
  reminderCategoryCreate,
  reminderCategoryUpdate,
  reminderCreate,
  reminderUpdate,
} from '@kortex/shared';
import * as svc from './service';

export const remindersRoutes: FastifyPluginAsync = async (app) => {
  // Categorias (cores das bolinhas do calendário)
  app.get('/categories', async () => svc.listCategories(app.db));
  app.post('/categories', async (req, reply) =>
    reply.status(201).send(svc.createCategory(app.db, reminderCategoryCreate.parse(req.body))),
  );
  app.patch('/categories/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return svc.updateCategory(app.db, id, reminderCategoryUpdate.parse(req.body));
  });
  app.delete('/categories/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    svc.deleteCategory(app.db, id);
    return reply.status(204).send();
  });

  // Ocorrências expandidas: GET /occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/occurrences', async (req) => {
    const { from, to } = occurrenceRange.parse(req.query);
    return svc.listOccurrences(app.db, from, to);
  });
  app.put('/:id/occurrences/:date', async (req) => {
    const { id, date } = occurrenceDateParam.parse(req.params);
    const { done } = occurrenceToggle.parse(req.body);
    return svc.setOccurrenceDone(app.db, id, date, done);
  });

  // Lembretes
  app.get('/', async () => svc.listReminders(app.db));
  app.get('/:id', async (req) => svc.getReminder(app.db, idParam.parse(req.params).id));
  app.post('/', async (req, reply) =>
    reply.status(201).send(svc.createReminder(app.db, reminderCreate.parse(req.body))),
  );
  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return svc.updateReminder(app.db, id, reminderUpdate.parse(req.body));
  });
  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    svc.deleteReminder(app.db, id);
    return reply.status(204).send();
  });
};
