import { Router } from 'express';
import {
  getInventorySummaryHandler,
  getInventoryTransactionsHandler,
  manualReceiptHandler,
  manualIssueHandler,
  manualAdjustmentHandler
} from '../controllers/inventoryController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createInventoryRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);

  router.get('/summary', getInventorySummaryHandler(dbInstance));
  router.get('/transactions', requireRole(['ADMIN']), getInventoryTransactionsHandler(dbInstance));
  router.post('/receipt', requireRole(['ADMIN']), manualReceiptHandler(dbInstance));
  router.post('/issue', requireRole(['ADMIN']), manualIssueHandler(dbInstance));
  router.post('/adjustment', requireRole(['ADMIN']), manualAdjustmentHandler(dbInstance));

  return router;
};

export default createInventoryRouter();
