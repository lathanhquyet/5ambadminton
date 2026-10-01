import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { roundupToThousand } from '../services/businessFormula';
import { calculateMonthlyFixedFees, calculateVisitorFees } from '../services/feeEngine';

describe('PHASE 3 MANDATORY TEST SUITE (FEE ENGINE, DEBT, PAYMENT & VIETQR)', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let memberId1: string;
  let memberId2: string;
  let visitorMemberId: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;

    // Create 2 Fixed Members and 1 Visitor Member for testing
    const m1Res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Fixed Member 1', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-10-01' });
    memberId1 = m1Res.body.data.id;

    const m2Res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Fixed Member 2', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-10-01' });
    memberId2 = m2Res.body.data.id;

    const m3Res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Visitor Member 1', member_type: 'VISITOR', days_per_week: 0, joined_date: '2026-10-01' });
    visitorMemberId = m3Res.body.data.id;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('TEST 1: Financial Rounding 774,100 -> 775,000', () => {
    expect(roundupToThousand(774100)).toBe(775000);
  });

  test('TEST 2: Financial Rounding 774,999 -> 775,000', () => {
    expect(roundupToThousand(774999)).toBe(775000);
  });

  test('TEST 3: Financial Rounding 775,000 -> 775,000', () => {
    expect(roundupToThousand(775000)).toBe(775000);
  });

  test('TEST 4: Debt = 500,000; Payment 200,000 then 300,000 => status = PAID', async () => {
    const monthKey = '2026-10';

    // Set up a member fee of 500,000 for memberId1
    db.prepare(`
      INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
      VALUES ('fee_test_500k', ?, ?, 'FIXED_FUND', 500000, 500000, 0, 500000, 'UNPAID')
    `).run(monthKey, memberId1);

    // Payment 1: 200,000
    const pay1Res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: memberId1,
        month_key: monthKey,
        payment_date: '2026-10-10',
        amount: 200000,
        payment_method: 'BANK_TRANSFER'
      });

    expect(pay1Res.status).toBe(200);
    expect(pay1Res.body.data.remainingDebtAfter).toBe(300000);

    // Verify status is PARTIAL
    let debtRes = await request(app)
      .get(`/api/v1/debts?month=${monthKey}`)
      .set('Authorization', `Bearer ${adminToken}`);
    let m1Debt = debtRes.body.data.find((d: any) => d.member_id === memberId1);
    expect(m1Debt.status).toBe('PARTIAL');
    expect(m1Debt.paid_amount).toBe(200000);
    expect(m1Debt.remaining_amount).toBe(300000);

    // Payment 2: 300,000
    const pay2Res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: memberId1,
        month_key: monthKey,
        payment_date: '2026-10-15',
        amount: 300000,
        payment_method: 'BANK_TRANSFER'
      });

    expect(pay2Res.status).toBe(200);
    expect(pay2Res.body.data.remainingDebtAfter).toBe(0);

    // Verify status is PAID
    debtRes = await request(app)
      .get(`/api/v1/debts?month=${monthKey}`)
      .set('Authorization', `Bearer ${adminToken}`);
    m1Debt = debtRes.body.data.find((d: any) => d.member_id === memberId1);
    expect(m1Debt.status).toBe('PAID');
    expect(m1Debt.paid_amount).toBe(500000);
    expect(m1Debt.remaining_amount).toBe(0);
  });

  test('TEST 5: Debt = 200,000; Payment = 300,000 => Error PAYMENT_EXCEEDS_DEBT (HTTP 400)', async () => {
    const monthKey = '2026-11';

    // Set up member fee of 200,000 for memberId2
    db.prepare(`
      INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
      VALUES ('fee_test_200k', ?, ?, 'FIXED_FUND', 200000, 200000, 0, 200000, 'UNPAID')
    `).run(monthKey, memberId2);

    // Try paying 300,000 for a 200,000 debt
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: memberId2,
        month_key: monthKey,
        payment_date: '2026-11-05',
        amount: 300000,
        payment_method: 'BANK_TRANSFER'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_DEBT');
    expect(res.body.error.message).toContain('không hỗ trợ nộp dư');
  });

  test('TEST 6: Fee config change does NOT alter historical member_fees', async () => {
    const pastMonth = '2026-08';

    // Calculate fees for pastMonth with 1,000,000 VND total cost
    calculateMonthlyFixedFees(db, {
      monthKey: pastMonth,
      calculationMethod: 'EQUAL_SPLIT',
      totalCostToAllocate: 1000000
    });

    const pastFeeBefore = db
      .prepare("SELECT rounded_amount FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'")
      .get(pastMonth, memberId1) as { rounded_amount: number };

    // Now change calculation parameters for a NEW month '2026-12' with 5,000,000 VND
    calculateMonthlyFixedFees(db, {
      monthKey: '2026-12',
      calculationMethod: 'EQUAL_SPLIT',
      totalCostToAllocate: 5000000
    });

    const pastFeeAfter = db
      .prepare("SELECT rounded_amount FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'")
      .get(pastMonth, memberId1) as { rounded_amount: number };

    // Past month fee must remain IDENTICAL
    expect(pastFeeAfter.rounded_amount).toBe(pastFeeBefore.rounded_amount);
  });

  test('TEST 7: Visitor fee = actual sessions * configured visitor unit price', async () => {
    const monthKey = '2026-10';

    // Create 3 sessions in Oct 2026
    const s1 = db.prepare(`INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('s1', '2026-10-01', ?, 'COMPLETED')`).run(monthKey);
    const s2 = db.prepare(`INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('s2', '2026-10-02', ?, 'COMPLETED')`).run(monthKey);
    const s3 = db.prepare(`INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('s3', '2026-10-03', ?, 'COMPLETED')`).run(monthKey);

    // Visitor attended 3 sessions as PRESENT
    db.prepare(`INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm_v1', 's1', ?, 'PRESENT')`).run(visitorMemberId);
    db.prepare(`INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm_v2', 's2', ?, 'PRESENT')`).run(visitorMemberId);
    db.prepare(`INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm_v3', 's3', ?, 'PRESENT')`).run(visitorMemberId);

    // Calculate Visitor fees @ 70,000 VND / session
    const result = calculateVisitorFees(db, monthKey, 70000);
    expect(result.count).toBe(1);

    const visitorFee = db
      .prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'VISITOR_FEE'")
      .get(monthKey, visitorMemberId) as any;

    expect(visitorFee).toBeDefined();
    expect(visitorFee.original_amount).toBe(210000); // 3 * 70,000 = 210,000
    expect(visitorFee.rounded_amount).toBe(210000);
  });

  test('TEST 8: VietQR amount = remaining debt EXACT', async () => {
    const monthKey = '2026-10';

    // Visitor member has 210,000 remaining debt from TEST 7
    const qrRes = await request(app)
      .get(`/api/v1/payments/${visitorMemberId}/qr?month=${monthKey}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(qrRes.status).toBe(200);
    expect(qrRes.body.success).toBe(true);
    expect(qrRes.body.data.amount).toBe(210000); // Exact remaining debt
    expect(qrRes.body.data.vietqr_url).toContain('amount=210000');
  });

  test('TEST 9: Multiple payment allocation never causes paid_amount to exceed rounded_amount', async () => {
    const monthKey = '2027-01';

    // Fee of 400,000
    db.prepare(`
      INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
      VALUES ('fee_test_400k', ?, ?, 'FIXED_FUND', 400000, 400000, 0, 400000, 'UNPAID')
    `).run(monthKey, memberId2);

    // Pay 200,000 twice
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: memberId2, month_key: monthKey, payment_date: '2026-12-01', amount: 200000 });

    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: memberId2, month_key: monthKey, payment_date: '2026-12-02', amount: 200000 });

    const feeAfter = db
      .prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'")
      .get(monthKey, memberId2) as any;

    expect(feeAfter.paid_amount).toBe(400000);
    expect(feeAfter.remaining_amount).toBe(0);
    expect(feeAfter.paid_amount).toBeLessThanOrEqual(feeAfter.rounded_amount);
  });

  test('TEST 10: Closed month cannot be recalculated or modified', async () => {
    const closedMonth = '2026-05';

    // Lock month '2026-05' in monthly_closings
    db.prepare(`
      INSERT INTO monthly_closings (id, month_key, status) VALUES ('close_202605', ?, 'CLOSED')
    `).run(closedMonth);

    // Attempt to recalculate fees for CLOSED month -> Throws Error
    expect(() => {
      calculateMonthlyFixedFees(db, {
        monthKey: closedMonth,
        calculationMethod: 'EQUAL_SPLIT',
        totalCostToAllocate: 1000000
      });
    }).toThrow(`tháng ${closedMonth} đã CHỐT (CLOSED)`);

    // Attempt payment for CLOSED month -> Returns HTTP 400 Bad Request
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: memberId1,
        month_key: closedMonth,
        payment_date: '2026-05-10',
        amount: 100000
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.success).toBe(false);
    expect(payRes.body.error.message).toContain('CLOSED');
  });
});
