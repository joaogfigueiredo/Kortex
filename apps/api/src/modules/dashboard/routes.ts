import type { FastifyPluginAsync } from 'fastify';
import { dashboardQuery } from '@kortex/shared';
import { dashboard } from './service';

/** /api/dashboard?today=YYYY-MM-DD&range=day|week|month */
export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const { today, range } = dashboardQuery.parse(req.query);
    return dashboard(app.db, today, range);
  });
};
