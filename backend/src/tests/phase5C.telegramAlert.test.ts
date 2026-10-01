import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { calculateMonthlyFixedFees } from '../services/feeEngine';
import { updatePaymentSettings } from '../services/paymentSettingsService';
import * as telegramService from '../services/telegramSettingsService';
import { clearNotificationCooldownMap } from '../controllers/publicPaymentController';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-5am-badminton';

function generateTestToken(role: 'ADMIN' | 'MEMBER', userId = 'usr_admin_default') {
  return jwt.sign({ id: userId, userId, username: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Phase 5C - Task 4 Remediation: Telegram Alert & Full Admin Settings Audit', () => {
  let app: any;
  let db: any;
  let adminToken: string;
  let memberToken: string;

  beforeEach(async () => {
    clearNotificationCooldownMap();

    db = new Database(':memory:');
    runMigrations(db);
    await runSeed(db);
    app = createApp(db);

    adminToken = generateTestToken('ADMIN', 'usr_admin_default');
    memberToken = generateTestToken('MEMBER', 'member_id_01');

    // Configure bank settings for VietQR
    updatePaymentSettings(db, {
      enabled: true,
      bankName: 'MB',
      bankBin: '970422',
      accountNumber: '090123456789',
      accountName: 'QUY CAU LONG 5AM'
    });

    // Create fixed members
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
      VALUES ('mem_fixed_01', 'A Nguyên', '0901111111', 'FIXED', 'ACTIVE', 3, '2026-01-01'),
             ('mem_fixed_02', 'A Thông', '0902222222', 'FIXED', 'ACTIVE', 3, '2026-01-01')
    `).run();

    // Calculate fixed monthly fees for 2026-10 (460k each)
    calculateMonthlyFixedFees(db, {
      monthKey: '2026-10',
      totalCostToAllocate: 920000,
      calculationMethod: 'EQUAL_SPLIT'
    });
  });

  describe('Section 2: Admin Settings Scope Audit (Four Required Sections)', () => {
    // 1. ADMIN PROFILE
    it('Area 1: Admin Profile GET & PUT (Username, Full Name, Email, Phone; Role unchangeable)', async () => {
      const getRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.username).toBe('admin');
      expect(getRes.body.data.role).toBe('ADMIN');

      const putRes = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Trần Văn Admin',
          email: 'admin@5ambadminton.com',
          phone: '0988888888',
          role: 'MEMBER' // Attempted role change MUST be ignored
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.fullName).toBe('Trần Văn Admin');
      expect(putRes.body.data.role).toBe('ADMIN'); // Role remains ADMIN
    });

    // 2. CHANGE PASSWORD
    it('Area 2: Change Password (Current Password check, hash update, zero passwordHash leak)', async () => {
      // Wrong current password
      const wrongRes = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newadminpass123',
          confirmPassword: 'newadminpass123'
        });
      expect(wrongRes.status).toBe(400);

      // Password mismatch
      const mismatchRes = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'admin123',
          newPassword: 'newadminpass123',
          confirmPassword: 'differentpass'
        });
      expect(mismatchRes.status).toBe(400);

      // Successful change
      const successRes = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'admin123',
          newPassword: 'newadminpass123',
          confirmPassword: 'newadminpass123'
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.success).toBe(true);
      expect(JSON.stringify(successRes.body)).not.toContain('passwordHash');
      expect(JSON.stringify(successRes.body)).not.toContain('password_hash');
    });

    // 3. RECEIVING BANK / VIETQR SETTINGS
    it('Area 3: Receiving Bank / VietQR Settings API (GET/PUT single source of truth)', async () => {
      const getRes = await request(app)
        .get('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.bankName).toBe('MB');
      expect(getRes.body.data.accountNumber).toBe('090123456789');

      const putRes = await request(app)
        .put('/api/v1/admin/payment-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          bankName: 'Vietcombank',
          bankBin: '970436',
          accountNumber: '9999999999',
          accountName: 'QUY CAU LONG 5AM OFFICIAL'
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.bankName).toBe('Vietcombank');
      expect(putRes.body.data.accountNumber).toBe('9999999999');
    });

    // 4 & 5. TELEGRAM BOT SETTINGS & SECRET PROTECTION
    it('Area 4 & 5: Telegram Bot Settings PUT & GET secret protection (0 raw/masked token leak)', async () => {
      const saveRes = await request(app)
        .put('/api/v1/admin/telegram-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
          chatId: '-100987654321'
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.data.enabled).toBe(true);
      expect(saveRes.body.data.hasBotToken).toBe(true);
      expect(saveRes.body.data.configured).toBe(true);
      expect(saveRes.body.data.chatId).toBe('-100987654321');

      // GET Endpoint Secret Protection Audit: ZERO token returned over the wire
      const getRes = await request(app)
        .get('/api/v1/admin/telegram-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.hasBotToken).toBe(true);
      expect(getRes.body.data.configured).toBe(true);
      expect(getRes.body.data.chatId).toBe('-100987654321');

      // ABSOLUTE SECRET AUDIT: NO raw or masked token in response JSON!
      const rawJson = JSON.stringify(getRes.body);
      expect(rawJson).not.toContain('botToken');
      expect(rawJson).not.toContain('botTokenMasked');
      expect(rawJson).not.toContain('123456789');
      expect(rawJson).not.toContain('ABCdef');
    });

    // 6. TELEGRAM TEST
    it('Area 6: Telegram Test notification endpoint works', async () => {
      jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValueOnce({
        success: true,
        message: 'Mocked telegram send success'
      });

      await request(app)
        .put('/api/v1/admin/telegram-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          botToken: '123456789:TEST_BOT_TOKEN',
          chatId: '-100987654321'
        });

      const testRes = await request(app)
        .post('/api/v1/admin/telegram-settings/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(testRes.status).toBe(200);
      expect(testRes.body.success).toBe(true);
    });
  });

  describe('Section 1 & 5: Public Telegram Alert Flow, Exact Messages & Injections', () => {
    beforeEach(async () => {
      await request(app)
        .put('/api/v1/admin/telegram-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          botToken: '123456789:TEST_BOT_TOKEN',
          chatId: '-100987654321'
        });
    });

    // 7, 9, 10, 11. PUBLIC FIXED MEMBER ALERT & EXACT TELEGRAM MESSAGE
    it('Area 7, 9, 10, 11: Public alert for FIXED member resolves exact message & QR amount', async () => {
      const spySend = jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValueOnce({
        success: true,
        message: 'Sent'
      });

      const paymentReference = '5AM-ANGUYEN-T10-2026';

      const res = await request(app)
        .post('/api/v1/public/payment/notify')
        .send({ paymentReference });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(spySend).toHaveBeenCalledTimes(1);
      const sentText = spySend.mock.calls[0][2];
      // Area 10: Mandatory exact message format: "Anh [Tên] đã chuyển khoản [Số tiền ₫]"
      expect(sentText).toBe('Anh A Nguyên đã chuyển khoản 460.000 ₫');
    });

    // 8. PUBLIC VISITOR ALERT
    it('Area 8: Public alert for VISITOR resolves exact name & visitor fee amount', async () => {
      await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-01',
          visitor: {
            full_name: 'Anh Thông 3',
            amount: 60000,
            is_paid: false
          }
        });

      const spySend = jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValueOnce({
        success: true,
        message: 'Sent'
      });

      const paymentReference = '5AM-ANHTHONG3-T10-2026';

      const res = await request(app)
        .post('/api/v1/public/payment/notify')
        .send({ paymentReference });

      expect(res.status).toBe(200);
      expect(spySend).toHaveBeenCalledTimes(1);
      const sentText = spySend.mock.calls[0][2];
      expect(sentText).toBe('Anh Anh Thông 3 đã chuyển khoản 60.000 ₫');
    });

    // 12, 13, 14, 15, 16, 17. VALIDATION & INJECTION BLOCKS
    it('Area 12-17: Backend blocks invalid paymentReference & ignores frontend injections', async () => {
      // Invalid payment reference
      const badRefRes = await request(app)
        .post('/api/v1/public/payment/notify')
        .send({ paymentReference: 'INVALID_REF' });
      expect(badRefRes.status).toBe(400);

      // Injections test
      const spySend = jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValueOnce({
        success: true,
        message: 'Sent'
      });

      const res = await request(app)
        .post('/api/v1/public/payment/notify')
        .send({
          paymentReference: '5AM-ANGUYEN-T10-2026',
          memberName: 'Hacker Injection Name',
          amount: 100,
          customMessage: 'Injected Message',
          botToken: 'HACKED_TOKEN',
          chatId: 'HACKED_CHAT_ID'
        });

      expect(res.status).toBe(200);
      expect(spySend).toHaveBeenCalledTimes(1);
      const [, chatIdArg, textArg] = spySend.mock.calls[0];

      expect(chatIdArg).toBe('-100987654321'); // Uses server configured chatId ONLY
      expect(textArg).toBe('Anh A Nguyên đã chuyển khoản 460.000 ₫'); // Resolved server-side ONLY
      expect(textArg).not.toContain('Hacker Injection Name');
      expect(textArg).not.toContain('100');
    });

    // 20. DOUBLE CLICK / RATE LIMITING
    it('Area 20: Double click rate limiting / cooldown suppression works', async () => {
      const spySend = jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValue({
        success: true,
        message: 'Sent'
      });

      const ref = '5AM-ANGUYEN-T10-2026';

      const res1 = await request(app).post('/api/v1/public/payment/notify').send({ paymentReference: ref });
      expect(res1.status).toBe(200);
      expect(res1.body.data.notified).toBe(true);

      const res2 = await request(app).post('/api/v1/public/payment/notify').send({ paymentReference: ref });
      expect(res2.status).toBe(200);
      expect(res2.body.data.notified).toBe(false);

      expect(spySend).toHaveBeenCalledTimes(1);
    });

    // 21, 22, 23, 24, 25. FINANCIAL ZERO MUTATION AUDIT
    it('Area 21-25: Telegram failure or alert dispatch produces ZERO financial mutation', async () => {
      jest.spyOn(telegramService, 'sendTelegramMessageRaw').mockResolvedValueOnce({
        success: false,
        error: 'Network Timeout'
      });

      const countIncomeBefore = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
      const countPaymentsBefore = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;
      const feeRowBefore = db.prepare("SELECT remaining_amount, fee_status FROM member_fees WHERE member_id = 'mem_fixed_01' AND month_key = '2026-10'").get();

      const res = await request(app)
        .post('/api/v1/public/payment/notify')
        .send({ paymentReference: '5AM-ANGUYEN-T10-2026' });

      expect(res.status).toBe(200);

      const countIncomeAfter = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
      const countPaymentsAfter = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;
      const feeRowAfter = db.prepare("SELECT remaining_amount, fee_status FROM member_fees WHERE member_id = 'mem_fixed_01' AND month_key = '2026-10'").get();

      expect(countIncomeAfter).toBe(countIncomeBefore);
      expect(countPaymentsAfter).toBe(countPaymentsBefore);
      expect(feeRowAfter.remaining_amount).toBe(feeRowBefore.remaining_amount);
      expect(feeRowAfter.fee_status).toBe(feeRowBefore.fee_status);
    });
  });
});
