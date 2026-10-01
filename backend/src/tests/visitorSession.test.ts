import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { getCashLedgerSummary } from '../services/cashLedgerService';
import { getVisitorFeeSummary } from '../services/visitorFeeService';

describe('VISITOR SESSION ATTENDANCE & VISITOR FEE MANDATORY TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let testSessionId: string;
  const monthKey = '2026-09';

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;

    // Create session
    const sRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-09-10' });
    testSessionId = sRes.body.data.id;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('TEST 1: Add new Walk-in Visitor (default fee 50,000, UNPAID)', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${testSessionId}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Vãng Lai A',
        phone: '0901112223',
        is_paid: false
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(50000);
    expect(res.body.data.status).toBe('UNPAID');

    // Total players incremented
    const session = db.prepare('SELECT total_players FROM playing_sessions WHERE id = ?').get(testSessionId) as any;
    expect(session.total_players).toBe(1);

    // Member created with VISITOR type
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(res.body.data.memberId) as any;
    expect(member.member_type).toBe('VISITOR');
    expect(member.full_name).toBe('Khách Vãng Lai A');

    // UNPAID fee does NOT create Income Transaction
    const incCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM income_transactions WHERE category = 'VISITOR_FEE'").get() as any
    ).cnt;
    expect(incCount).toBe(0);

    // UNPAID fee does NOT affect Cash Ledger
    const ledger = getCashLedgerSummary(db, monthKey);
    expect(ledger.total_income).toBe(0);
  });

  test('TEST 2: Visitor Fee EXACT AMOUNT (NO ROUNDING: 51,000 stays 51,000; 51,500 stays 51,500; 75,123 stays 75,123)', async () => {
    const exactAmounts = [51000, 51500, 75123];

    for (const amt of exactAmounts) {
      const res = await request(app)
        .post(`/api/v1/sessions/${testSessionId}/visitors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: `Khách ${amt}`,
          amount: amt,
          is_paid: false
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(amt); // EXACT AMOUNT, ZERO ROUNDING!

      const feeInDb = db.prepare('SELECT amount FROM session_visitor_fees WHERE id = ?').get(res.body.data.visitorFeeId) as any;
      expect(feeInDb.amount).toBe(amt);
    }
  });

  test('TEST 3: Add Visitor Paid Immediately -> Creates VISITOR_FEE Income & updates Cash Ledger', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${testSessionId}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Đã Thu Ngay',
        amount: 60000,
        is_paid: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.incomeTransactionId).toBeDefined();

    // Verify Income Transaction created
    const incTx = db.prepare('SELECT * FROM income_transactions WHERE id = ?').get(res.body.data.incomeTransactionId) as any;
    expect(incTx.category).toBe('VISITOR_FEE');
    expect(incTx.rounded_amount).toBe(60000);

    // Cash Ledger updated +60,000
    const ledger = getCashLedgerSummary(db, monthKey);
    expect(ledger.income_breakdown.visitor_fee).toBe(60000);
  });

  test('TEST 4: Mark Unpaid Visitor Fee as Paid (Thu Sau) & Idempotency', async () => {
    // Add unpaid visitor with fee 51,500
    const addRes = await request(app)
      .post(`/api/v1/sessions/${testSessionId}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Thu Sau',
        amount: 51500,
        is_paid: false
      });

    const feeId = addRes.body.data.visitorFeeId;

    // Mark Paid
    const payRes1 = await request(app)
      .post(`/api/v1/sessions/visitor-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payment_method: 'CASH' });

    expect(payRes1.status).toBe(200);
    expect(payRes1.body.data.status).toBe('PAID');

    // Retry Mark Paid (Idempotency) -> returns same, zero duplicate income record
    const payRes2 = await request(app)
      .post(`/api/v1/sessions/visitor-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payment_method: 'CASH' });

    expect(payRes2.status).toBe(200);
    expect(payRes2.body.data.incomeTransactionId).toBe(payRes1.body.data.incomeTransactionId);
  });

  test('TEST 5: Visitor attendance NEVER creates FIXED_FUND member_fee', async () => {
    const fixedFees = db
      .prepare("SELECT * FROM member_fees WHERE month_key = ? AND fee_type = 'FIXED_FUND'")
      .all(monthKey);

    // Zero fixed fund member fees created for visitors
    expect(fixedFees.length).toBe(0);
  });

  test('TEST 6: Visitor Fee Summary Metrics Reconciliation', async () => {
    const summary = getVisitorFeeSummary(db, monthKey);

    expect(summary.visitor_fee_due).toBeGreaterThan(0);
    expect(summary.visitor_fee_collected).toBeGreaterThan(0);
    expect(summary.visitor_fee_outstanding).toBe(summary.visitor_fee_due - summary.visitor_fee_collected);
    expect(summary.cash_income).toBe(summary.visitor_fee_collected);
  });

  test('TEST 7: Visitor Operations on CLOSED Month Blocked with HTTP 403', async () => {
    const closedMonth = '2026-07';
    db.prepare(`
      INSERT OR REPLACE INTO monthly_closings (id, month_key, status)
      VALUES ('closed_07_v', ?, 'CLOSED')
    `).run(closedMonth);

    const sClosed = db.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status)
      VALUES ('sess_closed', '2026-07-15', ?, 'OPEN')
    `).run(closedMonth);

    const res = await request(app)
      .post('/api/v1/sessions/sess_closed/visitors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Tháng Đóng',
        amount: 50000
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MONTH_CLOSED');
  });

  test('TEST 8: Attempting to remove PAID visitor is BLOCKED to preserve historical financial records', async () => {
    const addRes = await request(app)
      .post(`/api/v1/sessions/${testSessionId}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Xóa Cần Bảo Lưu',
        amount: 50000,
        is_paid: true
      });

    const memberId = addRes.body.data.memberId;
    const incTxId = addRes.body.data.incomeTransactionId;

    // Attempting to remove PAID visitor MUST be blocked
    const remRes = await request(app)
      .delete(`/api/v1/sessions/${testSessionId}/visitors/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(remRes.status).toBe(400);
    expect(remRes.body.error.message).toContain('Không thể xóa thành viên vãng lai đã thanh toán (PAID)');

    // Historical income transaction MUST remain preserved in DB
    const incTx = db.prepare('SELECT * FROM income_transactions WHERE id = ?').get(incTxId);
    expect(incTx).toBeDefined();
  });
});
