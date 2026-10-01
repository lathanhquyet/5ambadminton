import { Router } from 'express';
import { getDebtsHandler } from '../controllers/feeController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createDebtRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/', getDebtsHandler(dbInstance));

  return router;
};

export default createDebtRouter();
