import type { FastifyPluginAsync } from 'fastify';
import { idParam, projectCreate, projectMove, projectUpdate } from '@kortex/shared';
import { createProject, deleteProject, listProjects, moveProject, updateProject } from './service';

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => listProjects(app.db));

  app.post('/', async (req, reply) =>
    reply.status(201).send(createProject(app.db, projectCreate.parse(req.body))),
  );

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return updateProject(app.db, id, projectUpdate.parse(req.body));
  });

  app.post('/:id/move', async (req) => {
    const { id } = idParam.parse(req.params);
    return moveProject(app.db, id, projectMove.parse(req.body));
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    deleteProject(app.db, id);
    return reply.status(204).send();
  });
};
