import request from 'supertest';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { closeMonth, unlockMonth, getMonthlyClosingStatus, getAuditLogs } from '../services/closingService';
import { backupDatabase, restoreDatabase, verifyDatabaseIntegrity } from '../utils/backupUtils';
import { recordCourtFeeConfig, recordOtherIncome, recordOtherExpense } from '../services/cashLedgerService';
import { recordMemberPayment } from '../services/feeEngine';
import { addVisitorToSession } from '../services/visitorFeeService';

describe('PHASE 6 — PRODUCTION HARDENING & OPERATIONAL READINESS TEST SUITE', () => {
  let db: any;
  let app: any;
  let adminToken: string;
  let memberToken: string;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    runSeed(db);
    app = createApp(db);

    // Setup admin token
    const adminLogin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as any;
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign(
      { id: adminLogin.id, username: 'admin', role: 'ADMIN' },
      process.env.JWT_SECRET || 'super_secret_badminton_fund_jwt_key_2026'
    );

    // Setup member token
    const memberUser = db.prepare("SELECT id FROM users WHERE role = 'MEMBER'").get() as any;
    const memberUserId = memberUser ? memberUser.id : 'user_member_1';
    memberToken = jwt.sign(
      { id: memberUserId, username: 'member1', role: 'MEMBER' },
      process.env.JWT_SECRET || 'super_secret_badminton_fund_jwt_key_2026'
    );
  });

  afterEach(() => {
    if (db) db.close();
  });

  // =========================================================================
  // TASK 6.1 — MONTHLY CLOSING / MONTH LOCK
  // =========================================================================
  describe('TASK 6.1 — Monthly Closing / Month Lock', () => {
    test('1. OPEN month allows valid financial mutations', () => {
      const res = recordOtherIncome(db, {
        transactionDate: '2026-10-10',
        monthKey: '2026-10',
        description: 'Thu tài trợ giải đấu',
        amount: 1000000
      });
      expect(res.incomeTransactionId).toBeDefined();
      expect(res.amount).toBe(1000000);
    });

    test('2. closeMonth sets status to CLOSED and computes summary balance', () => {
      recordOtherIncome(db, {
        transactionDate: '2026-10-10',
        monthKey: '2026-10',
        description: 'Thu khac',
        amount: 500000
      });

      const closing = closeMonth(db, '2026-10', 'admin_1');
      expect(closing.status).toBe('CLOSED');
      expect(closing.month_key).toBe('2026-10');
      expect(closing.total_income).toBe(500000);
      expect(closing.closed_by).toBeDefined();
      expect(closing.closed_at).toBeDefined();
    });

    test('3. CLOSED month blocks financial mutations with 403 MONTH_CLOSED', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      // Attempt court fee config
      const courtRes = await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month_key: '2026-10',
          price_per_day: 100000,
          total_days: 10,
          total_courts: 2
        });

      expect(courtRes.status).toBe(403);
      expect(courtRes.body.error.code).toBe('MONTH_CLOSED');

      // Attempt other income
      const incomeRes = await request(app)
        .post('/api/v1/transactions/other-income')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-10-15',
          month_key: '2026-10',
          description: 'Test income on closed month',
          amount: 200000
        });

      expect(incomeRes.status).toBe(403);
      expect(incomeRes.body.error.code).toBe('MONTH_CLOSED');
    });

    test('4. CLOSED month still allows read-only queries and reports', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      const reportRes = await request(app)
        .get('/api/v1/reports/monthly?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.success).toBe(true);
      expect(reportRes.body.data.month).toBe('2026-10');
    });
  });

  // =========================================================================
  // TASK 6.2 — ADMIN UNLOCK + AUDIT LOG
  // =========================================================================
  describe('TASK 6.2 — Admin Unlock + Audit Log', () => {
    test('1. Non-admin user cannot unlock closed month (403 FORBIDDEN)', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      const res = await request(app)
        .post('/api/v1/closings/2026-10/unlock')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ reason: 'Member request unlock' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('2. Unlock request without reason fails with 400 REASON_REQUIRED', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      const res = await request(app)
        .post('/api/v1/closings/2026-10/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REASON_REQUIRED');
    });

    test('3. Admin unlock with reason sets status to OPEN and records audit log', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      const unlockRes = await request(app)
        .post('/api/v1/closings/2026-10/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Cần bổ sung hóa đơn nước uống bị sót' });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.data.status).toBe('OPEN');
      expect(unlockRes.body.data.unlock_reason).toBe('Cần bổ sung hóa đơn nước uống bị sót');

      // Verify audit log entry
      const logs = getAuditLogs(db, { module: 'MONTHLY_CLOSING', recordId: '2026-10' });
      expect(logs.length).toBeGreaterThanOrEqual(2); // CLOSE and UNLOCK entries
      const unlockLog = logs.find((l) => l.action === 'UNLOCK_MONTH');
      expect(unlockLog).toBeDefined();
      expect(unlockLog?.new_value_json).toContain('Cần bổ sung hóa đơn nước uống bị sót');
    });
  });

  // =========================================================================
  // TASK 6.3 — BACKUP / RESTORE / DATABASE INTEGRITY
  // =========================================================================
  describe('TASK 6.3 — Backup / Restore / Database Integrity', () => {
    test('1. verifyDatabaseIntegrity validates PRAGMA integrity_check and critical tables', () => {
      const integrity = verifyDatabaseIntegrity(db);
      expect(integrity.ok).toBe(true);
      expect(integrity.pragmaResult).toBe('ok');
      expect(integrity.missingTables.length).toBe(0);
      expect(integrity.tableCount).toBeGreaterThanOrEqual(22);
    });

    test('2. Backup, restore, and financial reconciliation equality check', async () => {
      // Record income and expense
      recordOtherIncome(db, {
        transactionDate: '2026-10-05',
        monthKey: '2026-10',
        description: 'Tien quy',
        amount: 2000000
      });

      recordOtherExpense(db, {
        transactionDate: '2026-10-06',
        monthKey: '2026-10',
        description: 'Mua nuoc',
        amount: 500000
      });

      const tempDir = path.join(__dirname, '../../tmp_test_backup');
      const backupPath = path.join(tempDir, 'test_backup.db');
      const restoredPath = path.join(tempDir, 'restored_test.db');

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      try {
        await backupDatabase(db, backupPath);
        expect(fs.existsSync(backupPath)).toBe(true);

        const restoredIntegrity = restoreDatabase(backupPath, restoredPath);
        expect(restoredIntegrity.ok).toBe(true);

        // Verify financial data inside restored db
        const restoredDb = new Database(restoredPath);
        const incomeSum = restoredDb.prepare('SELECT SUM(rounded_amount) as total FROM income_transactions').get() as any;
        const expenseSum = restoredDb.prepare('SELECT SUM(rounded_amount) as total FROM expense_transactions').get() as any;
        expect(incomeSum.total).toBe(2000000);
        expect(expenseSum.total).toBe(500000);
        restoredDb.close();
      } finally {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        if (fs.existsSync(restoredPath)) fs.unlinkSync(restoredPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      }
    });
  });

  // =========================================================================
  // TASK 6.4 — EXPORT & DATA PORTABILITY
  // =========================================================================
  describe('TASK 6.4 — Export & Data Portability', () => {
    test('1. Monthly report CSV export returns valid CSV content', async () => {
      const res = await request(app)
        .get('/api/v1/exports/monthly-report?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Metric,Value');
      expect(res.text).toContain('2026-10');
    });

    test('2. Audit logs CSV export returns CSV string', async () => {
      closeMonth(db, '2026-10', 'admin_1');

      const res = await request(app)
        .get('/api/v1/exports/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('ID,ThoiGian,UserID,HanhDong,Module');
      expect(res.text).toContain('CLOSE_MONTH');
    });
  });

  // =========================================================================
  // TASK 6.5 — HEALTH & PRODUCTION READINESS
  // =========================================================================
  describe('TASK 6.5 — Health & Production Readiness', () => {
    test('1. GET /health returns HTTP 200 with OK status and DB integrity data', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('OK');
      expect(res.body.database.integrity).toBe('HEALTHY');
    });

    test('2. GET /api/v1/health returns HTTP 200 with OK status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  // =========================================================================
  // CRITICAL FINANCIAL REGRESSION SCENARIO
  // =========================================================================
  describe('CRITICAL FINANCIAL REGRESSION SCENARIO', () => {
    test('Visitor 5 sessions x 50,000 = 250,000 debt -> Admin Payment 250,000 -> Debt 0 -> Income +250,000 VISITOR_FEE -> Next session +50,000 -> Debt 50,000', () => {
      // 1. Create Visitor member Dũng
      const visitorId = 'member_visitor_dung';
      db.prepare(`
        INSERT INTO members (id, full_name, member_type, status, joined_date)
        VALUES (?, 'Dũng', 'VISITOR', 'ACTIVE', '2026-10-01')
      `).run(visitorId);

      // 2. Create 5 playing sessions and add Dũng as UNPAID visitor fee 50,000 each
      for (let i = 1; i <= 5; i++) {
        const sessionId = `session_2026100${i}`;
        const sessionDate = `2026-10-0${i}`;
        db.prepare(`
          INSERT INTO playing_sessions (id, session_date, month_key, status)
          VALUES (?, ?, '2026-10', 'COMPLETED')
        `).run(sessionId, sessionDate);

        addVisitorToSession(db, {
          sessionId,
          memberId: visitorId,
          amount: 50000
        });
      }

      // 3. Confirm 250,000 aggregate debt payment
      const paymentResult = recordMemberPayment(db, {
        memberId: visitorId,
        monthKey: '2026-10',
        paymentDate: '2026-10-06',
        amount: 250000,
        paymentMethod: 'BANK_TRANSFER',
        bankTxCode: 'TX_VISITOR_250K',
        notes: 'Dũng đóng 5 buổi vãng lai'
      });

      expect(paymentResult.amountPaid).toBe(250000);
      expect(paymentResult.remainingDebtAfter).toBe(0);

      // Verify income transactions created
      const incomeCount = db.prepare(`
        SELECT COUNT(*) as cnt, SUM(rounded_amount) as total
        FROM income_transactions
        WHERE category = 'VISITOR_FEE' AND member_id = ?
      `).get(visitorId) as any;

      expect(incomeCount.cnt).toBe(5);
      expect(incomeCount.total).toBe(250000);

      // 4. Dũng plays another session (Session #6)
      const session6Id = 'session_20261006';
      db.prepare(`
        INSERT INTO playing_sessions (id, session_date, month_key, status)
        VALUES (?, '2026-10-06', '2026-10', 'COMPLETED')
      `).run(session6Id);

      addVisitorToSession(db, {
        sessionId: session6Id,
        memberId: visitorId,
        amount: 50000
      });

      // Verify new debt = 50,000
      const remainingDebt = db.prepare(`
        SELECT SUM(amount) as total_debt
        FROM session_visitor_fees
        WHERE member_id = ? AND status = 'UNPAID'
      `).get(visitorId) as any;

      expect(remainingDebt.total_debt).toBe(50000);
    });
  });
});
