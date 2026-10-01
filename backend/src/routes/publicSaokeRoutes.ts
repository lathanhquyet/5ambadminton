import { Router } from 'express';
import {
  getPublicSaokeMonthlyReportHandler,
  getPublicSaokeDebtorsHandler,
  getPublicFundPaymentReportHandler,
  getPublicExpenseReportHandler,
  getPublicAttendanceReportHandler,
  getPublicShuttleUsageReportHandler
} from '../controllers/publicSaokeController';

export const createPublicSaokeRouter = (dbInstance?: any) => {
  const router = Router();

  // Public endpoints - NO auth middleware attached
  router.get('/monthly', getPublicSaokeMonthlyReportHandler(dbInstance));
  router.get('/debtors', getPublicSaokeDebtorsHandler(dbInstance));

  // Task 6.9 Reports & Statistics Endpoints
  router.get('/reports/fund-payments', getPublicFundPaymentReportHandler(dbInstance));
  router.get('/reports/expenses', getPublicExpenseReportHandler(dbInstance));
  router.get('/reports/attendance', getPublicAttendanceReportHandler(dbInstance));
  router.get('/reports/shuttle-usage', getPublicShuttleUsageReportHandler(dbInstance));

  return router;
};

export default createPublicSaokeRouter();
