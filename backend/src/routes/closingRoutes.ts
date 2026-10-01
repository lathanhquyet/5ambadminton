import { Router } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';
import {
  getClosingStatusHandler,
  closeMonthHandler,
  unlockMonthHandler,
  getAuditLogsHandler
} from '../controllers/closingController';

export const createClosingRouter = (dbInstance?: DatabaseType): Router => {
  const router = Router();

  router.get('/logs', authenticateJwt, requireRole(['ADMIN']), getAuditLogsHandler(dbInstance));
  router.get('/:month', authenticateJwt, getClosingStatusHandler(dbInstance));
  router.post('/:month/close', authenticateJwt, requireRole(['ADMIN']), closeMonthHandler(dbInstance));
  router.post('/:month/unlock', authenticateJwt, requireRole(['ADMIN']), unlockMonthHandler(dbInstance));

  return router;
};

export default createClosingRouter();
