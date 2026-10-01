import { Router } from 'express';
import {
  getAdminTelegramSettingsHandler,
  updateAdminTelegramSettingsHandler,
  testAdminTelegramHandler
} from '../controllers/adminTelegramController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createAdminTelegramRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/', getAdminTelegramSettingsHandler(dbInstance));
  router.put('/', updateAdminTelegramSettingsHandler(dbInstance));
  router.post('/test', testAdminTelegramHandler(dbInstance));

  return router;
};

export default createAdminTelegramRouter();
