import { Router } from 'express';
import { getMonthlyReportHandler } from '../controllers/reportController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createReportRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/monthly', getMonthlyReportHandler(dbInstance));

  return router;
};

export default createReportRouter();
