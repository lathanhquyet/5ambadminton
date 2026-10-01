import { Router } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { authenticateJwt } from '../middlewares/authMiddleware';
import {
  exportMonthlyReportCSVHandler,
  exportIncomeCSVHandler,
  exportExpenseCSVHandler,
  exportVisitorDebtsCSVHandler,
  exportAuditLogsCSVHandler
} from '../controllers/exportController';

export const createExportRouter = (dbInstance?: DatabaseType): Router => {
  const router = Router();

  router.get('/monthly-report', authenticateJwt, exportMonthlyReportCSVHandler(dbInstance));
  router.get('/income', authenticateJwt, exportIncomeCSVHandler(dbInstance));
  router.get('/expense', authenticateJwt, exportExpenseCSVHandler(dbInstance));
  router.get('/visitor-debts', authenticateJwt, exportVisitorDebtsCSVHandler(dbInstance));
  router.get('/audit-logs', authenticateJwt, exportAuditLogsCSVHandler(dbInstance));

  return router;
};

export default createExportRouter();
