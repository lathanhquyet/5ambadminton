import { Router } from 'express';
import { recordPaymentHandler, generateVietQRHandler } from '../controllers/feeController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createPaymentRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.post('/', recordPaymentHandler(dbInstance));
  router.get('/:member_id/qr', generateVietQRHandler(dbInstance));

  return router;
};

export default createPaymentRouter();
