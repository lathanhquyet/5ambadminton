import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { recordMemberPayment, getMemberDebts } from '../services/feeEngine';

describe('FINANCIAL RECONCILIATION TEST SUITE (MEMBER_FEES -> PAYMENTS -> ALLOCATIONS -> INCOME_TRANSACTIONS)', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let testMemberId: string;
  const monthKey = '2026-10';

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;

    // Create a test member
    const mRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Financial Recon Member', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-10-01' });
    testMemberId = mRes.body.data.id;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('RECON TEST 1: Create member_fee with rounded_amount = 500,000 -> Expected paid=0, remaining=500,000, status=UNPAID', () => {
    const feeId = 'fee_recon_500k';
    db.prepare(`
      INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
      VALUES (?, ?, ?, 'FIXED_FUND', 500000, 500000, 0, 500000, 'UNPAID')
    `).run(feeId, monthKey, testMemberId);

    const fee = db.prepare('SELECT * FROM member_fees WHERE id = ?').get(feeId) as any;

    expect(fee).toBeDefined();
    expect(fee.paid_amount).toBe(0);
    expect(fee.remaining_amount).toBe(500000);
    expect(fee.fee_status).toBe('UNPAID');
  });

  test('RECON TEST 2: Payment 200,000 -> paid_amount = 200,000, remaining = 300,000, status = PARTIAL, SUM(allocations) = 200,000, 1 income record', async () => {
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: testMemberId,
        month_key: monthKey,
        payment_date: '2026-10-10',
        amount: 200000,
        payment_method: 'BANK_TRANSFER',
        bank_tx_code: 'TX_RECON_001'
      });

    expect(payRes.status).toBe(200);

    // 1. Assert member_fee status
    const fee = db.prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'").get(monthKey, testMemberId) as any;
    expect(fee.paid_amount).toBe(200000);
    expect(fee.remaining_amount).toBe(300000);
    expect(fee.fee_status).toBe('PARTIAL');

    // 2. Assert SUM(payment_allocations)
    const allocSum = (
      db.prepare(`
        SELECT COALESCE(SUM(pa.allocated_amount), 0) AS total
        FROM payment_allocations pa
        JOIN payments p ON pa.payment_id = p.id
        WHERE p.month_key = ? AND p.member_id = ?
      `).get(monthKey, testMemberId) as { total: number }
    ).total;
    expect(allocSum).toBe(200000);

    // 3. Assert income_transactions: exactly 1 record
    const incRecords = db
      .prepare('SELECT * FROM income_transactions WHERE month_key = ? AND member_id = ?')
      .all(monthKey, testMemberId) as any[];

    expect(incRecords.length).toBe(1);
    expect(incRecords[0].rounded_amount).toBe(200000);
    expect(incRecords[0].payment_id).toBe(payRes.body.data.paymentId);
  });

  test('RECON TEST 3: Second payment 300,000 -> paid_amount = 500,000, remaining = 0, status = PAID. SUM(payments) = 500k, SUM(allocations) = 500k, SUM(income) = 500k', async () => {
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: testMemberId,
        month_key: monthKey,
        payment_date: '2026-10-15',
        amount: 300000,
        payment_method: 'BANK_TRANSFER',
        bank_tx_code: 'TX_RECON_002'
      });

    expect(payRes.status).toBe(200);

    // 1. Assert member_fee
    const fee = db.prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'").get(monthKey, testMemberId) as any;
    expect(fee.paid_amount).toBe(500000);
    expect(fee.remaining_amount).toBe(0);
    expect(fee.fee_status).toBe('PAID');

    // 2. SUM(payments)
    const paySum = (
      db.prepare('SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM payments WHERE month_key = ? AND member_id = ?')
        .get(monthKey, testMemberId) as { total: number }
    ).total;

    // 3. SUM(payment_allocations)
    const allocSum = (
      db.prepare(`
        SELECT COALESCE(SUM(pa.allocated_amount), 0) AS total
        FROM payment_allocations pa
        JOIN payments p ON pa.payment_id = p.id
        WHERE p.month_key = ? AND p.member_id = ?
      `).get(monthKey, testMemberId) as { total: number }
    ).total;

    // 4. SUM(income_transactions)
    const incSum = (
      db.prepare('SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM income_transactions WHERE month_key = ? AND member_id = ?')
        .get(monthKey, testMemberId) as { total: number }
    ).total;

    expect(paySum).toBe(500000);
    expect(allocSum).toBe(500000);
    expect(incSum).toBe(500000);
  });

  test('RECON TEST 4: Duplicate payment retry with same bank_tx_code MUST NOT create duplicate income transaction', async () => {
    const incCountBefore = (
      db.prepare('SELECT COUNT(*) AS cnt FROM income_transactions WHERE month_key = ? AND member_id = ?').get(monthKey, testMemberId) as any
    ).cnt;

    // Retry payment with existing transaction code TX_RECON_001
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: testMemberId,
        month_key: monthKey,
        payment_date: '2026-10-10',
        amount: 200000,
        payment_method: 'BANK_TRANSFER',
        bank_tx_code: 'TX_RECON_001'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_PAYMENT');

    const incCountAfter = (
      db.prepare('SELECT COUNT(*) AS cnt FROM income_transactions WHERE month_key = ? AND member_id = ?').get(monthKey, testMemberId) as any
    ).cnt;

    expect(incCountAfter).toBe(incCountBefore); // Zero duplicate income transactions created
  });

  test('RECON TEST 5: Payment allocation points to the exact target member_fee', () => {
    const allocations = db
      .prepare(`
        SELECT pa.*, mf.fee_type, mf.member_id
        FROM payment_allocations pa
        JOIN member_fees mf ON pa.member_fee_id = mf.id
        WHERE mf.month_key = ? AND mf.member_id = ?
      `)
      .all(monthKey, testMemberId) as any[];

    allocations.forEach((alloc) => {
      expect(alloc.member_id).toBe(testMemberId);
      expect(alloc.fee_type).toBe('FIXED_FUND');
    });
  });

  test('RECON TEST 6: Debt is calculated strictly from member_fees + payment_allocations, NOT inferred backwards from income_transactions', () => {
    const debts = getMemberDebts(db, monthKey);
    const targetDebt = debts.find((d) => d.member_id === testMemberId);

    expect(targetDebt).toBeDefined();
    expect(targetDebt?.total_fee_required).toBe(500000);
    expect(targetDebt?.paid_amount).toBe(500000);
    expect(targetDebt?.remaining_amount).toBe(0);
    expect(targetDebt?.status).toBe('PAID');
  });

  test('RECON TEST 7: Cash Ledger does NOT double-count income (Cash income = 500,000, NOT 1,000,000 or 1,500,000)', () => {
    const totalCashIncome = (
      db.prepare(`
        SELECT COALESCE(SUM(rounded_amount), 0) AS total
        FROM income_transactions
        WHERE month_key = ? AND member_id = ? AND is_void = 0
      `).get(monthKey, testMemberId) as { total: number }
    ).total;

    expect(totalCashIncome).toBe(500000);
  });

  test('RECON TEST 8: FULL RECONCILIATION EQUALITY ASSERTION (paid_amount == alloc_sum == payments_sum == income_sum)', () => {
    const fee = db.prepare("SELECT paid_amount FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'").get(monthKey, testMemberId) as { paid_amount: number };

    const allocSum = (
      db.prepare(`
        SELECT COALESCE(SUM(pa.allocated_amount), 0) AS total
        FROM payment_allocations pa
        JOIN payments p ON pa.payment_id = p.id
        WHERE p.month_key = ? AND p.member_id = ?
      `).get(monthKey, testMemberId) as { total: number }
    ).total;

    const paySum = (
      db.prepare('SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM payments WHERE month_key = ? AND member_id = ?')
        .get(monthKey, testMemberId) as { total: number }
    ).total;

    const incSum = (
      db.prepare('SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM income_transactions WHERE month_key = ? AND member_id = ? AND is_void = 0')
        .get(monthKey, testMemberId) as { total: number }
    ).total;

    // FULL EQUALITY ASSERTION
    expect(fee.paid_amount).toBe(500000);
    expect(allocSum).toBe(fee.paid_amount);
    expect(paySum).toBe(fee.paid_amount);
    expect(incSum).toBe(fee.paid_amount);

    console.log('✓ FULL FINANCIAL RECONCILIATION EQUALITY CONFIRMED: 500,000 = 500,000 = 500,000 = 500,000');
  });
});
