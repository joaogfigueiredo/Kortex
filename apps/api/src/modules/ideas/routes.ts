import type { FastifyPluginAsync } from 'fastify';
import { idParam, ideaCreate, ideaMove, ideaUpdate } from '@kortex/shared';
import { createIdea, deleteIdea, listIdeas, moveIdea, promoteIdea, updateIdea } from './service';

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => listIdeas(app.db));

  app.post('/', async (req, reply) => {
    const idea = createIdea(app.db, ideaCreate.parse(req.body));
    return reply.status(201).send(idea);
  });

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return updateIdea(app.db, id, ideaUpdate.parse(req.body));
  });

  app.post('/:id/move', async (req) => {
    const { id } = idParam.parse(req.params);
    return moveIdea(app.db, id, ideaMove.parse(req.body));
  });

  app.post('/:id/promote', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    return reply.status(201).send(promoteIdea(app.db, id));
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    deleteIdea(app.db, id);
    return reply.status(204).send();
  });
};
