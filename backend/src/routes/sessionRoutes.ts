import { Router } from 'express';
import {
  getSessionsHandler,
  getSessionByIdHandler,
  createSessionHandler,
  updateSessionHandler,
  updateAttendanceHandler,
  updateShuttleUsageHandler,
  cancelSessionHandler,
  addVisitorHandler,
  markVisitorFeePaidHandler,
  updateVisitorFeeHandler,
  removeVisitorHandler,
  getVisitorFeeSummaryHandler,
  confirmVisitorPaymentByAdminHandler,
  bulkEditSessionHandler
} from '../controllers/sessionController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createSessionRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/', getSessionsHandler(dbInstance));
  router.get('/visitor-fees/summary', getVisitorFeeSummaryHandler(dbInstance));
  router.post('/visitor-fees/confirm-payment', confirmVisitorPaymentByAdminHandler(dbInstance));
  router.post('/visitor-fees/:feeId/pay', markVisitorFeePaidHandler(dbInstance));
  router.put('/visitor-fees/:feeId', updateVisitorFeeHandler(dbInstance));

  router.get('/:id', getSessionByIdHandler(dbInstance));
  router.post('/', createSessionHandler(dbInstance));
  router.put('/:id', updateSessionHandler(dbInstance));
  router.post('/:id/bulk-edit', bulkEditSessionHandler(dbInstance));
  router.post('/:id/attendance', updateAttendanceHandler(dbInstance));
  router.put('/:id/shuttle-usage', updateShuttleUsageHandler(dbInstance));
  router.post('/:id/cancel', cancelSessionHandler(dbInstance));

  // Visitor Management in Sessions
  router.post('/:id/visitors', addVisitorHandler(dbInstance));
  router.delete('/:id/visitors/:memberId', removeVisitorHandler(dbInstance));

  return router;
};

export default createSessionRouter();
