import { Router } from 'express';
import { getAdminPaymentSettingsHandler, updateAdminPaymentSettingsHandler } from '../controllers/adminPaymentSettingsController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createAdminPaymentSettingsRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/', getAdminPaymentSettingsHandler(dbInstance));
  router.put('/', updateAdminPaymentSettingsHandler(dbInstance));

  return router;
};

export default createAdminPaymentSettingsRouter();
