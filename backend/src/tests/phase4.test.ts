import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { getCurrentStockInPieces } from '../services/inventoryService';
import { getCashLedgerSummary, getInventoryCarryForward } from '../services/cashLedgerService';

describe('PHASE 4 MANDATORY TEST SUITE (CASH LEDGER & MID-MONTH JOINER)', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let testMemberId: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;

    // Create a member
    const mRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Phase 4 Member', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-09-01' });
    testMemberId = mRes.body.data.id;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('TEST 1: Buy 10 tubes @ 650,000 / tube => Expense = 6,500,000 & Inventory Receipt = 120 pieces', async () => {
    const monthKey = '2026-09';
    const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

    const res = await request(app)
      .post('/api/v1/transactions/shuttle-purchase')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchase_date: '2026-09-05',
        month_key: monthKey,
        supplier: 'Thể Thao X',
        tubes_qty: 10,
        price_per_tube: 650000,
        notes: 'Mua 10 ống cầu đợt 1'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAmount).toBe(6500000);
    expect(res.body.data.piecesQty).toBe(120);

    // Verify expense_transaction created
    const expTx = db
      .prepare("SELECT * FROM expense_transactions WHERE id = ?")
      .get(res.body.data.expenseTransactionId) as any;

    expect(expTx).toBeDefined();
    expect(expTx.category).toBe('SHUTTLE_PURCHASE');
    expect(expTx.rounded_amount).toBe(6500000);

    // Verify inventory stock increased by 120 pieces
    const stockAfter = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter).toBe(stockBefore + 120);
  });

  test('TEST 2: Shuttle purchase does NOT create duplicate expense transactions', async () => {
    const monthKey = '2026-09';
    const expCountBefore = (
      db.prepare("SELECT COUNT(*) AS cnt FROM expense_transactions WHERE category = 'SHUTTLE_PURCHASE'").get() as any
    ).cnt;

    // Single purchase call created 1 expense record
    expect(expCountBefore).toBe(1);
  });

  test('TEST 3: Using shuttles in sessions does NOT create any expense_transaction', async () => {
    const expCountBefore = (
      db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any
    ).cnt;

    // Create session & use 4 shuttles
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-09-10' });
    const sessionId = sessionRes.body.data.id;

    await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 4 });

    const expCountAfter = (
      db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any
    ).cnt;

    // Zero new expense transactions generated
    expect(expCountAfter).toBe(expCountBefore);
  });

  test('TEST 4: Court fee: price_per_day * total_days * total_courts => accurate expense_transaction', async () => {
    const monthKey = '2026-09';

    // Court fee: 300,000 / day * 12 days * 1 court = 3,600,000
    const res = await request(app)
      .post('/api/v1/transactions/court-fee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        month_key: monthKey,
        price_per_day: 300000,
        total_days: 12,
        total_courts: 1,
        notes: 'Tiền sân tháng 9'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalAmount).toBe(3600000);

    const expTx = db
      .prepare("SELECT * FROM expense_transactions WHERE id = ?")
      .get(res.body.data.expenseTransactionId) as any;

    expect(expTx).toBeDefined();
    expect(expTx.category).toBe('COURT_FEE');
    expect(expTx.rounded_amount).toBe(3600000);
  });

  test('TEST 5: Mid-month joiner: Admin enters 400,000 => income_transaction category OTHER_INCOME & NO FIXED_FUND fee record for that member in month', async () => {
    const monthKey = '2026-09';

    // Create mid-month joiner member
    const mRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Mid Joiner Member', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-09-15' });
    const midMemberId = mRes.body.data.id;

    // Record manual income 400,000
    const incRes = await request(app)
      .post('/api/v1/transactions/mid-month-joiner')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: midMemberId,
        month_key: monthKey,
        transaction_date: '2026-09-15',
        amount: 400000
      });

    expect(incRes.status).toBe(201);

    const incTx = db
      .prepare("SELECT * FROM income_transactions WHERE id = ?")
      .get(incRes.body.data.incomeTransactionId) as any;

    expect(incTx).toBeDefined();
    expect(incTx.category).toBe('OTHER_INCOME');
    expect(incTx.rounded_amount).toBe(400000);
    expect(incTx.member_id).toBe(midMemberId);

    // Verify NO FIXED_FUND member_fee record exists for this midMemberId in monthKey
    const feeRecord = db
      .prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'")
      .get(monthKey, midMemberId);

    expect(feeRecord).toBeUndefined();
  });

  test('TEST 6: Cash Ledger: Income = 10,000,000, Expense = 8,000,000 => Ending Balance = 2,000,000', async () => {
    const testMonth = '2026-08';

    // Insert Income = 10,000,000
    db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_test_10m', '2026-08-01', ?, 'OTHER_INCOME', 'Thu test 10m', 10000000, 10000000, 0)
    `).run(testMonth);

    // Insert Expense = 8,000,000
    db.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_test_8m', '2026-08-01', ?, 'OTHER_EXPENSE', 'Chi test 8m', 8000000, 8000000, 0)
    `).run(testMonth);

    const summary = getCashLedgerSummary(db, testMonth);

    expect(summary.total_income).toBe(10000000);
    expect(summary.total_expense).toBe(8000000);
    expect(summary.net_month_balance).toBe(2000000);
    expect(summary.ending_balance).toBe(2000000);
    expect(summary.balance_status).toBe('POSITIVE');
  });

  test('TEST 7: VOID transactions are NOT included in Cash Ledger calculations', async () => {
    const testMonth = '2026-08';

    // Void the 10m income transaction
    const voidRes = await request(app)
      .post('/api/v1/transactions/void')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'INCOME',
        transaction_id: 'inc_test_10m'
      });

    expect(voidRes.status).toBe(200);

    const summaryAfterVoid = getCashLedgerSummary(db, testMonth);

    // Income becomes 0, Expense is 8,000,000 => Ending Balance = -8,000,000
    expect(summaryAfterVoid.total_income).toBe(0);
    expect(summaryAfterVoid.total_expense).toBe(8000000);
    expect(summaryAfterVoid.ending_balance).toBe(-8000000);
    expect(summaryAfterVoid.balance_status).toBe('NEGATIVE');
  });

  test('TEST 8: Ending Balance Month 09/2026 -> Opening Balance Month 10/2026 (Carry Forward)', async () => {
    // Un-void 10m income for clean test
    db.prepare("UPDATE income_transactions SET is_void = 0 WHERE id = 'inc_test_10m'").run();

    const septSummary = getCashLedgerSummary(db, '2026-09');
    const octSummary = getCashLedgerSummary(db, '2026-10');

    // Oct opening balance must EXACTLY match Sept ending balance
    expect(octSummary.opening_balance).toBe(septSummary.ending_balance);
  });

  test('TEST 9: Closing inventory Month 09 -> Opening inventory Month 10 (Carry Forward)', async () => {
    const septInv = getInventoryCarryForward(db, '2026-09');
    const octInv = getInventoryCarryForward(db, '2026-10');

    // Oct opening inventory pieces must EXACTLY match Sept closing inventory pieces
    expect(octInv.opening_stock_pieces).toBe(septInv.closing_stock_pieces);
  });

  test('TEST 10: Re-running court fee operation updates existing record without duplicate expense transaction', async () => {
    const monthKey = '2026-09';

    const expCountBefore = (
      db.prepare("SELECT COUNT(*) AS cnt FROM expense_transactions WHERE category = 'COURT_FEE' AND month_key = ?").get(monthKey) as any
    ).cnt;

    // Re-run court fee config for 2026-09
    const res = await request(app)
      .post('/api/v1/transactions/court-fee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        month_key: monthKey,
        price_per_day: 320000,
        total_days: 12,
        total_courts: 1,
        notes: 'Cập nhật tiền sân'
      });

    expect(res.status).toBe(200);

    const expCountAfter = (
      db.prepare("SELECT COUNT(*) AS cnt FROM expense_transactions WHERE category = 'COURT_FEE' AND month_key = ?").get(monthKey) as any
    ).cnt;

    // Count must remain 1 (updated in-place, zero duplicate created)
    expect(expCountAfter).toBe(expCountBefore);

    const updatedTx = db
      .prepare("SELECT rounded_amount FROM expense_transactions WHERE category = 'COURT_FEE' AND month_key = ?")
      .get(monthKey) as { rounded_amount: number };

    expect(updatedTx.rounded_amount).toBe(3840000); // 320,000 * 12 * 1 = 3,840,000
  });
});
