import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { calculateMonthlyFixedFees } from '../services/feeEngine';
import { updatePaymentSettings } from '../services/paymentSettingsService';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-5am-badminton';

function generateTestToken(role: 'ADMIN' | 'MEMBER', userId = 'test_user_id') {
  return jwt.sign({ userId, username: 'testuser', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Phase 5C - Task 3: VietQR Payment & Admin Bank Config', () => {
  let app: any;
  let db: any;
  let adminToken: string;
  let memberToken: string;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    runSeed(db);
    app = createApp(db);

    adminToken = generateTestToken('ADMIN', 'admin_id_01');
    memberToken = generateTestToken('MEMBER', 'member_id_01');

    // Create fixed members and calculate fees for 2026-09
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
      VALUES ('mem_01', 'Nguyễn Văn A', '0901111111', 'FIXED', 'ACTIVE', 3, '2026-01-01'),
             ('mem_02', 'Trần Thị B', '0902222222', 'FIXED', 'ACTIVE', 2, '2026-01-01')
    `).run();

    calculateMonthlyFixedFees(db, {
      monthKey: '2026-09',
      totalCostToAllocate: 700000,
      calculationMethod: 'EQUAL_SPLIT'
    });
  });

  describe('1. Admin Bank Account Configuration API', () => {
    it('should reject unauthenticated GET /api/v1/admin/payment-settings with 401', async () => {
      const res = await request(app).get('/api/v1/admin/payment-settings');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin GET /api/v1/admin/payment-settings with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow admin GET /api/v1/admin/payment-settings and return default bank info', async () => {
      const res = await request(app)
        .get('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        enabled: true,
        bankName: 'MB',
        bankBin: '970436',
        accountNumber: '090123456789',
        accountName: 'QUY CAU LONG 5AM'
      });
    });

    it('should reject unauthenticated PUT /api/v1/admin/payment-settings with 401', async () => {
      const res = await request(app)
        .put('/api/v1/admin/payment-settings')
        .send({ bankName: 'Vietcombank', accountNumber: '0123456789' });
      expect(res.status).toBe(401);
    });

    it('should reject invalid bank settings update (empty accountNumber)', async () => {
      const res = await request(app)
        .put('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          bankName: 'MB',
          bankBin: '970436',
          accountNumber: '   ',
          accountName: 'QUY CAU LONG 5AM'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Số tài khoản (accountNumber) không được để trống.');
    });

    it('should update bank configuration when valid admin request is sent', async () => {
      const res = await request(app)
        .put('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          bankName: 'Vietcombank',
          bankBin: '970436',
          accountNumber: '0987654321',
          accountName: 'QUY CAU LONG 5AM OFFICIAL'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        enabled: true,
        bankName: 'Vietcombank',
        bankBin: '970436',
        accountNumber: '0987654321',
        accountName: 'QUY CAU LONG 5AM OFFICIAL'
      });

      // Verify persistence
      const getRes = await request(app)
        .get('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.data.bankName).toBe('Vietcombank');
      expect(getRes.body.data.accountNumber).toBe('0987654321');
    });
  });

  describe('2. Public Payment Info API', () => {
    it('should return public bank info without requiring authentication', async () => {
      const res = await request(app).get('/api/v1/public/payment-info');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('enabled');
      expect(res.body.data).toHaveProperty('bankName');
      expect(res.body.data).toHaveProperty('bankBin');
      expect(res.body.data).toHaveProperty('accountNumber');
      expect(res.body.data).toHaveProperty('accountName');

      // Security check: must NOT leak internal tokens/secrets/passwords
      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain('password');
      expect(rawJson).not.toContain('jwt');
      expect(rawJson).not.toContain('secret');
      expect(rawJson).not.toContain('token');
    });
  });

  describe('3. Dynamic VietQR Generation API', () => {
    it('should generate valid dynamic payment QR for member with remaining debt', async () => {
      const res = await request(app).get('/api/v1/public/payment/qr?month=2026-09&memberId=mem_01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.month).toBe('2026-09');
      expect(data.memberName).toBe('Nguyễn Văn A');
      expect(data.amount).toBe(350000);
      expect(data.bankName).toBe('MB');
      expect(data.accountNumber).toBe('090123456789');
      expect(data.transferContent).toContain('5AM-NGUYENVANA-T09-2026');
      expect(data.qr.url).toContain('https://img.vietqr.io/image/');
      expect(data.qr.url).toContain('350000');
    });

    it('should reject invalid month format with 400', async () => {
      const res = await request(app).get('/api/v1/public/payment/qr?month=2026-13&memberId=mem_01');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_MONTH');
    });

    it('should reject non-existent memberId with 404', async () => {
      const res = await request(app).get('/api/v1/public/payment/qr?month=2026-09&memberId=mem_9999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
    });

    it('should block QR generation if payment is disabled', async () => {
      updatePaymentSettings(db, { enabled: false });

      const res = await request(app).get('/api/v1/public/payment/qr?month=2026-09&memberId=mem_01');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');
    });

    it('should block QR generation if amount <= 0 (member has no debt)', async () => {
      // Create member with zero debt
      db.prepare(`
        INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
        VALUES ('mem_nodebt', 'Phạm Văn C', '0903333333', 'FIXED', 'ACTIVE', 3, '2026-01-01')
      `).run();

      const res = await request(app).get('/api/v1/public/payment/qr?month=2026-09&memberId=mem_nodebt');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NO_PAYMENT_DUE');
      expect(res.body.error.message).toBe('Không có khoản cần thanh toán.');
    });

    it('CRITICAL RULE: Generating QR MUST NOT mutate financial records or change payment status', async () => {
      // Snapshots of database before QR generation
      const paymentsBefore = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;
      const incomeBefore = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
      const feeBefore = db.prepare('SELECT * FROM member_fees WHERE member_id = ? AND month_key = ?').get('mem_01', '2026-09') as any;

      // Call QR generation 5 times
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/v1/public/payment/qr?month=2026-09&memberId=mem_01');
        expect(res.status).toBe(200);
      }

      // Snapshots of database after QR generation
      const paymentsAfter = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;
      const incomeAfter = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
      const feeAfter = db.prepare('SELECT * FROM member_fees WHERE member_id = ? AND month_key = ?').get('mem_01', '2026-09') as any;

      expect(paymentsAfter).toBe(paymentsBefore);
      expect(incomeAfter).toBe(incomeBefore);
      expect(feeAfter.paid_amount).toBe(feeBefore.paid_amount);
      expect(feeAfter.remaining_amount).toBe(feeBefore.remaining_amount);
      expect(feeAfter.fee_status).toBe(feeBefore.fee_status);
      expect(feeAfter.fee_status).toBe('UNPAID');
    });
  });
});
