import { Router } from 'express';
import {
  loginHandler,
  getMeHandler,
  getAdminProfileHandler,
  updateAdminProfileHandler,
  changePasswordHandler
} from '../controllers/authController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createAuthRouter = (dbInstance?: any) => {
  const router = Router();

  router.post('/login', loginHandler(dbInstance));
  router.get('/me', authenticateJwt, getMeHandler);

  // Admin Profile & Password Management
  router.get('/profile', authenticateJwt, requireRole(['ADMIN']), getAdminProfileHandler(dbInstance));
  router.put('/profile', authenticateJwt, requireRole(['ADMIN']), updateAdminProfileHandler(dbInstance));
  router.put('/change-password', authenticateJwt, requireRole(['ADMIN']), changePasswordHandler(dbInstance));

  return router;
};

export default createAuthRouter();
