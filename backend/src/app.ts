import express, { Express } from 'express';
import cors from 'cors';
import { Database as DatabaseType } from 'better-sqlite3';
import { createAuthRouter } from './routes/authRoutes';
import { createMemberRouter } from './routes/memberRoutes';
import { createSessionRouter } from './routes/sessionRoutes';
import { createInventoryRouter } from './routes/inventoryRoutes';
import { createFeeRouter } from './routes/feeRoutes';
import { createDebtRouter } from './routes/debtRoutes';
import { createPaymentRouter } from './routes/paymentRoutes';
import { createTransactionRouter } from './routes/transactionRoutes';
import { createReportRouter } from './routes/reportRoutes';
import { createPublicSaokeRouter } from './routes/publicSaokeRoutes';
import { createAdminPaymentSettingsRouter } from './routes/adminPaymentSettingsRoutes';
import { createAdminTelegramRouter } from './routes/adminTelegramRoutes';
import { createPublicPaymentRouter, createPublicPaymentInfoRouter } from './routes/publicPaymentRoutes';
import { createClosingRouter } from './routes/closingRoutes';
import { createExportRouter } from './routes/exportRoutes';
import { verifyDatabaseIntegrity } from './utils/backupUtils';
import { defaultDb } from './database/db';

export const createApp = (dbInstance?: DatabaseType): Express => {
  const app = express();
  const db = dbInstance || defaultDb;

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json());

  // Healthcheck endpoints (/health & /api/v1/health)
  const healthHandler = (req: express.Request, res: express.Response) => {
    try {
      const integrity = verifyDatabaseIntegrity(db);
      return res.status(200).json({
        success: true,
        status: integrity.ok ? 'OK' : 'DEGRADED',
        version: 'V3.1',
        database: {
          integrity: integrity.ok ? 'HEALTHY' : 'UNHEALTHY',
          tableCount: integrity.tableCount,
          missingTables: integrity.missingTables
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        status: 'ERROR',
        error: err.message
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Mount API Routers
  app.use('/api/v1/auth', createAuthRouter(db));
  app.use('/api/v1/members', createMemberRouter(db));
  app.use('/api/v1/sessions', createSessionRouter(db));
  app.use('/api/v1/inventory', createInventoryRouter(db));
  app.use('/api/v1/fees', createFeeRouter(db));
  app.use('/api/v1/debts', createDebtRouter(db));
  app.use('/api/v1/payments', createPaymentRouter(db));
  app.use('/api/v1/transactions', createTransactionRouter(db));
  app.use('/api/v1/reports', createReportRouter(db));
  app.use('/api/v1/public/saoke', createPublicSaokeRouter(db));
  app.use('/api/v1/admin/payment-settings', createAdminPaymentSettingsRouter(db));
  app.use('/api/v1/admin/telegram-settings', createAdminTelegramRouter(db));
  app.use('/api/v1/public/payment-info', createPublicPaymentInfoRouter(db));
  app.use('/api/v1/public/payment', createPublicPaymentRouter(db));
  app.use('/api/v1/closings', createClosingRouter(db));
  app.use('/api/v1/exports', createExportRouter(db));

  // 404 Handler
  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API Endpoint không tồn tại.' }
    });
  });

  return app;
};
