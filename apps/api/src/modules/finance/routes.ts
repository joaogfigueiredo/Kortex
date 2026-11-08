import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  financeActivityCreate,
  financeActivityUpdate,
  financeEntryCreate,
  financeEntryUpdate,
  financeMove,
  idParam,
} from '@kortex/shared';
import {
  createActivity,
  createEntry,
  deleteActivity,
  deleteEntry,
  listActivities,
  listEntries,
  moveActivity,
  updateActivity,
  updateEntry,
} from './service';

const entryParam = z.object({ entryId: z.coerce.number().int().positive() });

export const financeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => listActivities(app.db));

  app.post('/', async (req, reply) =>
    reply.status(201).send(createActivity(app.db, financeActivityCreate.parse(req.body))),
  );

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return updateActivity(app.db, id, financeActivityUpdate.parse(req.body));
  });

  app.post('/:id/move', async (req) => {
    const { id } = idParam.parse(req.params);
    return moveActivity(app.db, id, financeMove.parse(req.body));
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    deleteActivity(app.db, id);
    return reply.status(204).send();
  });

  // Histórico, observações e avisos
  app.get('/:id/entries', async (req) => {
    const { id } = idParam.parse(req.params);
    return listEntries(app.db, id);
  });

  app.post('/:id/entries', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    return reply.status(201).send(createEntry(app.db, id, financeEntryCreate.parse(req.body)));
  });

  app.patch('/entries/:entryId', async (req) => {
    const { entryId } = entryParam.parse(req.params);
    return updateEntry(app.db, entryId, financeEntryUpdate.parse(req.body));
  });

  app.delete('/entries/:entryId', async (req, reply) => {
    const { entryId } = entryParam.parse(req.params);
    deleteEntry(app.db, entryId);
    return reply.status(204).send();
  });
};
