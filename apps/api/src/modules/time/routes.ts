import type { FastifyPluginAsync } from 'fastify';
import { idParam, timeEntryCreate, timeEntryQuery } from '@kortex/shared';
import { createTimeEntry, deleteTimeEntry, listTimeEntries } from './service';

/** Registro de tempo genérico: sessões de estudo, Modo Foco, trabalho… */
export const timeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => listTimeEntries(app.db, timeEntryQuery.parse(req.query)));

  app.post('/', async (req, reply) =>
    reply.status(201).send(createTimeEntry(app.db, timeEntryCreate.parse(req.body))),
  );

  app.delete('/:id', async (req, reply) => {
    deleteTimeEntry(app.db, idParam.parse(req.params).id);
    return reply.status(204).send();
  });
};
