import request from 'supertest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { clearNotificationCooldownMap } from '../controllers/publicPaymentController';
import { addVisitorToSession } from '../services/visitorFeeService';
import { getMemberDebts } from '../services/feeEngine';
import { getMonthlyDashboardReport } from '../services/reportService';
import { updatePaymentSettings } from '../services/paymentSettingsService';

const JWT_SECRET = process.env.JWT_SECRET || '5am_badminton_secret_key_2026_change_in_production';

function generateTestToken(role: 'ADMIN' | 'MEMBER' = 'ADMIN', userId = 'usr_admin_default') {
  return jwt.sign({ id: userId, userId, username: 'admin', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('VISITOR PAYMENT REQUEST -> TELEGRAM ALERT -> ADMIN CONFIRMATION TEST SUITE', () => {
  let db: DatabaseType;
  let app: any;
  let adminToken: string;

  const monthKey = '2026-10';
  let visitorMemberId: string;

  beforeEach(async () => {
    clearNotificationCooldownMap();

    db = new Database(':memory:');
    runMigrations(db);
    await runSeed(db);
    app = createApp(db);

    adminToken = generateTestToken('ADMIN', 'usr_admin_default');

    // Configure Payment Settings for VietQR
    updatePaymentSettings(db, {
      enabled: true,
      bankName: 'MB',
      bankBin: '970422',
      accountNumber: '090123456789',
      accountName: 'QUY CAU LONG 5AM'
    });

    // Configure Telegram settings so notification passes
    db.prepare(`
      INSERT OR REPLACE INTO telegram_settings (id, bot_token, chat_id, enabled)
      VALUES ('default', '8805766187:AAERLeSyBfeqlu_eoSZF3rNhH8K67b7G3qg', '-1001234567890', 1)
    `).run();

    // Create 5 Sessions in 2026-10
    const dates = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-09'];
    dates.forEach((d, idx) => {
      const sessId = `sess_vis_${idx + 1}`;
      db.prepare(`
        INSERT INTO playing_sessions (id, session_date, month_key, status, total_players)
        VALUES (?, ?, ?, 'OPEN', 1)
      `).run(sessId, d, monthKey);
    });

    // Create a Visitor Member "Dũng Vãng Lai"
    visitorMemberId = 'mem_dung_visitor';
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date)
      VALUES (?, 'Dũng Vãng Lai', '0901111222', 'VISITOR', 'ACTIVE', '2026-10-01')
    `).run(visitorMemberId);

    // Add Visitor to all 5 sessions @ 50,000 each => Total Outstanding = 250,000 UNPAID
    dates.forEach((d, idx) => {
      const sessId = `sess_vis_${idx + 1}`;
      addVisitorToSession(db, {
        sessionId: sessId,
        memberId: visitorMemberId,
        amount: 50000,
        isPaid: false
      });
    });
  });

  test('TEST 1 & 2 & 3 — Visitor click Confirm Paid creates payment request, 0 Income, 0 debt reduction, sends Telegram Alert', async () => {
    // 1. Initial State Check: Outstanding = 250,000, Income = 0
    const initialDebts = getMemberDebts(db, monthKey);
    const vDebtInitial = initialDebts.find((d) => d.member_id === visitorMemberId);
    expect(vDebtInitial).toBeDefined();
    expect(vDebtInitial?.remaining_amount).toBe(250000);
    expect(vDebtInitial?.status).toBe('UNPAID');

    const reportInitial = getMonthlyDashboardReport(db, monthKey);
    expect(reportInitial.financial.totalIncome).toBe(0);

    // 2. Fetch VietQR paymentReference
    const qrRes = await request(app)
      .get(`/api/v1/public/payment/qr?month=${monthKey}&memberId=${visitorMemberId}`)
      .expect(200);

    const paymentRef = qrRes.body.data.transferContent;
    expect(paymentRef).toContain('5AM-');

    // 3. Visitor clicks "Xác nhận đã đóng" -> POST /api/v1/public/payment/notify
    const notifyRes = await request(app)
      .post('/api/v1/public/payment/notify')
      .send({ paymentReference: paymentRef })
      .expect(200);

    expect(notifyRes.body.success).toBe(true);

    // 4. Verify Post-Notification State: Debt MUST STILL BE 250,000 (ZERO DEBT REDUCTION), Income MUST STILL BE 0
    const debtsPostNotify = getMemberDebts(db, monthKey);
    const vDebtPostNotify = debtsPostNotify.find((d) => d.member_id === visitorMemberId);
    expect(vDebtPostNotify?.remaining_amount).toBe(250000);
    expect(vDebtPostNotify?.status).toBe('PAYMENT_REQUESTED');

    const reportPostNotify = getMonthlyDashboardReport(db, monthKey);
    expect(reportPostNotify.financial.totalIncome).toBe(0); // ZERO INCOME CREATED

    // Verify /saoke public debtors endpoint shows remaining debt > 0 and status PAYMENT_REQUESTED
    const saokeRes = await request(app)
      .get(`/api/v1/public/saoke/debtors?month=${monthKey}`)
      .expect(200);

    const saokeVisitor = saokeRes.body.data.find((d: any) => d.paymentReference === paymentRef);
    expect(saokeVisitor).toBeDefined();
    expect(saokeVisitor.remainingAmount).toBe(250000);
    expect(saokeVisitor.status).toBe('PAYMENT_REQUESTED');
  });

  test('TEST 4 & 5 — Admin confirmation transitions to PAID, Debt = 0, Income +250k, Category = VISITOR_FEE', async () => {
    // 1. Visitor requests payment
    const qrRes = await request(app)
      .get(`/api/v1/public/payment/qr?month=${monthKey}&memberId=${visitorMemberId}`)
      .expect(200);

    const paymentRef = qrRes.body.data.transferContent;

    await request(app)
      .post('/api/v1/public/payment/notify')
      .send({ paymentReference: paymentRef })
      .expect(200);

    const reportBeforeConfirm = getMonthlyDashboardReport(db, monthKey);
    const totalIncBefore = reportBeforeConfirm.financial.totalIncome;

    // 2. Admin Confirms Payment -> POST /api/v1/sessions/visitor-fees/confirm-payment
    const confirmRes = await request(app)
      .post('/api/v1/sessions/visitor-fees/confirm-payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: visitorMemberId,
        month_key: monthKey,
        payment_method: 'BANK_TRANSFER'
      })
      .expect(200);

    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.totalAmount).toBe(250000);
    expect(confirmRes.body.data.status).toBe('PAID');

    // 3. Verify Debt = 0 & Income = +250k
    const debtsPostConfirm = getMemberDebts(db, monthKey);
    const vDebtPostConfirm = debtsPostConfirm.find((d) => d.member_id === visitorMemberId);
    expect(vDebtPostConfirm?.remaining_amount).toBe(0);
    expect(vDebtPostConfirm?.status).toBe('PAID');

    const reportAfterConfirm = getMonthlyDashboardReport(db, monthKey);
    expect(reportAfterConfirm.financial.totalIncome).toBe(totalIncBefore + 250000);

    // Verify Income Transaction Category = VISITOR_FEE
    const incTx = db.prepare('SELECT * FROM income_transactions WHERE id = ?').get(confirmRes.body.data.incomeTransactionId) as any;
    expect(incTx.category).toBe('VISITOR_FEE');
    expect(incTx.rounded_amount).toBe(250000);
  });

  test('TEST 6 — Double Visitor click anti-duplicate protection', async () => {
    const qrRes = await request(app)
      .get(`/api/v1/public/payment/qr?month=${monthKey}&memberId=${visitorMemberId}`)
      .expect(200);

    const paymentRef = qrRes.body.data.transferContent;

    // First click
    await request(app)
      .post('/api/v1/public/payment/notify')
      .send({ paymentReference: paymentRef })
      .expect(200);

    // Second click immediately
    const res2 = await request(app)
      .post('/api/v1/public/payment/notify')
      .send({ paymentReference: paymentRef })
      .expect(200);

    expect(res2.body.data.notified).toBe(false);

    // Ensure 0 Income transactions created
    const incCount = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;
    expect(incCount).toBe(0);
  });

  test('TEST 7 — Double Admin confirmation idempotency', async () => {
    // Visitor requests payment
    const qrRes = await request(app)
      .get(`/api/v1/public/payment/qr?month=${monthKey}&memberId=${visitorMemberId}`)
      .expect(200);

    await request(app)
      .post('/api/v1/public/payment/notify')
      .send({ paymentReference: qrRes.body.data.transferContent })
      .expect(200);

    // Admin Confirm 1
    const res1 = await request(app)
      .post('/api/v1/sessions/visitor-fees/confirm-payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: visitorMemberId, month_key: monthKey })
      .expect(200);

    expect(res1.body.data.paidCount).toBe(5);

    // Admin Confirm 2 (Idempotent retry)
    const res2 = await request(app)
      .post('/api/v1/sessions/visitor-fees/confirm-payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: visitorMemberId, month_key: monthKey })
      .expect(200);

    expect(res2.body.data.paidCount).toBe(0);
    expect(res2.body.data.totalAmount).toBe(0);

    // Verify exactly ONE income transaction was recorded for visitor fee
    const incCount = (db.prepare("SELECT COUNT(*) as cnt FROM income_transactions WHERE category = 'VISITOR_FEE'").get() as any).cnt;
    expect(incCount).toBe(1);
  });

  test('TEST 8 — New Visitor Session after PAID starts new UNPAID debt', async () => {
    // 1. Admin confirms 250k debt
    await request(app)
      .post('/api/v1/sessions/visitor-fees/confirm-payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: visitorMemberId, month_key: monthKey })
      .expect(200);

    // 2. Add Visitor to a 6th session on 2026-10-12
    const sessId6 = 'sess_vis_6';
    db.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status, total_players)
      VALUES (?, '2026-10-12', ?, 'OPEN', 1)
    `).run(sessId6, monthKey);

    addVisitorToSession(db, {
      sessionId: sessId6,
      memberId: visitorMemberId,
      amount: 50000,
      isPaid: false
    });

    // 3. Outstanding debt MUST be 50,000
    const debts = getMemberDebts(db, monthKey);
    const vDebt = debts.find((d) => d.member_id === visitorMemberId);
    expect(vDebt?.remaining_amount).toBe(50000);
  });
});
