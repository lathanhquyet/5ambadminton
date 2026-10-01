import { Router } from 'express';
import { calculateMonthlyFeesHandler } from '../controllers/feeController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createFeeRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.post('/calculate-monthly', calculateMonthlyFeesHandler(dbInstance));

  return router;
};

export default createFeeRouter();
