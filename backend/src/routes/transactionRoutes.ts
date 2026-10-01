import { Router } from 'express';
import {
  getLedgerSummaryHandler,
  recordCourtFeeHandler,
  recordShuttlePurchaseHandler,
  recordMidMonthJoinerHandler,
  recordOtherExpenseHandler,
  recordVisitorFeeManualHandler,
  recordOtherIncomeHandler,
  getTransactionHistoryHandler,
  voidTransactionHandler
} from '../controllers/cashLedgerController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createTransactionRouter = (dbInstance?: any) => {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/ledger-summary', getLedgerSummaryHandler(dbInstance));
  router.get('/history', getTransactionHistoryHandler(dbInstance));
  router.post('/court-fee', recordCourtFeeHandler(dbInstance));
  router.post('/shuttle-purchase', recordShuttlePurchaseHandler(dbInstance));
  router.post('/mid-month-joiner', recordMidMonthJoinerHandler(dbInstance));
  router.post('/other-expense', recordOtherExpenseHandler(dbInstance));
  router.post('/visitor-fee', recordVisitorFeeManualHandler(dbInstance));
  router.post('/other-income', recordOtherIncomeHandler(dbInstance));
  router.post('/void', voidTransactionHandler(dbInstance));

  return router;
};

export default createTransactionRouter();
