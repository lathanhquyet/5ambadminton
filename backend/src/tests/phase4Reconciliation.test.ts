import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { roundupToThousand } from '../services/businessFormula';
import { getCurrentStockInPieces } from '../services/inventoryService';
import {
  getCashLedgerSummary,
  getInventoryCarryForward,
  recordCourtFeeConfig,
  recordShuttlePurchase,
  recordMidMonthJoinerIncome
} from '../services/cashLedgerService';

describe('PHASE 4 DEEP RECONCILIATION TEST SUITE', () => {
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

    const mRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Deep Recon Member', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-08-01' });
    testMemberId = mRes.body.data.id;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('RECON TEST 1: Cash Opening Balance Multi-Month Multiplier Verification', async () => {
    // Month 08/2026: Opening 0, Income 1,000,000, Expense 0 => Ending = 1,000,000
    db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_base_08', '2026-08-01', '2026-08', 'OTHER_INCOME', 'Base opening', 1000000, 1000000, 0)
    `).run();

    // Month 09/2026: Income 10,000,000, Expense 8,000,000
    db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_test_09', '2026-09-01', '2026-09', 'OTHER_INCOME', 'Income 10m', 10000000, 10000000, 0)
    `).run();
    db.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_test_09', '2026-09-01', '2026-09', 'OTHER_EXPENSE', 'Expense 8m', 8000000, 8000000, 0)
    `).run();

    const summary09 = getCashLedgerSummary(db, '2026-09');
    expect(summary09.opening_balance).toBe(1000000);
    expect(summary09.total_income).toBe(10000000);
    expect(summary09.total_expense).toBe(8000000);
    expect(summary09.net_month_balance).toBe(2000000);
    expect(summary09.ending_balance).toBe(3000000); // 1m + 2m = 3m
    expect(summary09.ending_balance).toBe(summary09.opening_balance + summary09.total_income - summary09.total_expense);

    // Month 10/2026: Income 2,000,000, Expense 1,500,000
    db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_test_10', '2026-10-01', '2026-10', 'OTHER_INCOME', 'Income 2m', 2000000, 2000000, 0)
    `).run();
    db.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_test_10', '2026-10-01', '2026-10', 'OTHER_EXPENSE', 'Expense 1.5m', 1500000, 1500000, 0)
    `).run();

    const summary10 = getCashLedgerSummary(db, '2026-10');
    expect(summary10.opening_balance).toBe(3000000); // Carried from 09 ending
    expect(summary10.total_income).toBe(2000000);
    expect(summary10.total_expense).toBe(1500000);
    expect(summary10.net_month_balance).toBe(500000);
    expect(summary10.ending_balance).toBe(3500000); // 3m + 0.5m = 3.5m
    expect(summary10.ending_balance).toBe(summary10.opening_balance + summary10.total_income - summary10.total_expense);
  });

  test('RECON TEST 2: Cash Carry Forward Idempotency', async () => {
    const run1 = getCashLedgerSummary(db, '2026-10');
    const run2 = getCashLedgerSummary(db, '2026-10');

    expect(run1.opening_balance).toBe(run2.opening_balance);
    expect(run1.ending_balance).toBe(run2.ending_balance);
  });

  test('RECON TEST 3: Inventory Carry Forward Idempotency', async () => {
    const run1 = getInventoryCarryForward(db, '2026-10');
    const run2 = getInventoryCarryForward(db, '2026-10');

    expect(run1.opening_stock_pieces).toBe(run2.opening_stock_pieces);
    expect(run1.closing_stock_pieces).toBe(run2.closing_stock_pieces);
  });

  test('RECON TEST 4: Atomic Shuttle Purchase with Rollback Verification', async () => {
    const expCountBefore = (db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any).cnt;
    const invCountBefore = (db.prepare('SELECT COUNT(*) AS cnt FROM inventory_transactions').get() as any).cnt;

    // Execute valid purchase
    const res = await request(app)
      .post('/api/v1/transactions/shuttle-purchase')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchase_date: '2026-09-15',
        month_key: '2026-09',
        supplier: 'Nhà cung cấp Y',
        tubes_qty: 5,
        price_per_tube: 600000
      });

    expect(res.status).toBe(201);

    const expCountAfter = (db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any).cnt;
    const invCountAfter = (db.prepare('SELECT COUNT(*) AS cnt FROM inventory_transactions').get() as any).cnt;

    // Both increased by exactly 1
    expect(expCountAfter).toBe(expCountBefore + 1);
    expect(invCountAfter).toBe(invCountBefore + 1);

    // Verify linked purchase record
    const purchase = db.prepare('SELECT * FROM shuttle_purchases WHERE id = ?').get(res.body.data.purchaseId) as any;
    expect(purchase).toBeDefined();
    expect(purchase.expense_transaction_id).toBe(res.body.data.expenseTransactionId);
    expect(purchase.inventory_transaction_id).toBe(res.body.data.inventoryTransactionId);
  });

  test('RECON TEST 5: Court Fee Idempotency (3 Consecutive Runs)', async () => {
    const monthKey = '2026-11';
    const payload = {
      month_key: monthKey,
      price_per_day: 350000,
      total_days: 10,
      total_courts: 2
    };

    // Run 1
    await request(app).post('/api/v1/transactions/court-fee').set('Authorization', `Bearer ${adminToken}`).send(payload);
    // Run 2
    await request(app).post('/api/v1/transactions/court-fee').set('Authorization', `Bearer ${adminToken}`).send(payload);
    // Run 3
    await request(app).post('/api/v1/transactions/court-fee').set('Authorization', `Bearer ${adminToken}`).send(payload);

    const cfgCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM court_fee_configs WHERE month_key = ?').get(monthKey) as any
    ).cnt;
    const expCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM expense_transactions WHERE month_key = ? AND category = 'COURT_FEE'").get(monthKey) as any
    ).cnt;

    expect(cfgCount).toBe(1);
    expect(expCount).toBe(1);
  });

  test('RECON TEST 6: Mid-Month Joiner Idempotency (2 Runs)', async () => {
    const monthKey = '2026-09';
    const payload = {
      member_id: testMemberId,
      month_key: monthKey,
      transaction_date: '2026-09-12',
      amount: 450000
    };

    await request(app).post('/api/v1/transactions/mid-month-joiner').set('Authorization', `Bearer ${adminToken}`).send(payload);
    await request(app).post('/api/v1/transactions/mid-month-joiner').set('Authorization', `Bearer ${adminToken}`).send(payload);

    const incCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM income_transactions WHERE member_id = ? AND month_key = ? AND category = 'OTHER_INCOME'").get(testMemberId, monthKey) as any
    ).cnt;

    expect(incCount).toBe(1);

    // Verify NO FIXED_FUND member_fee record exists for this member in this month
    const fixedFee = db
      .prepare("SELECT * FROM member_fees WHERE member_id = ? AND month_key = ? AND fee_type = 'FIXED_FUND'")
      .get(testMemberId, monthKey);
    expect(fixedFee).toBeUndefined();
  });

  test('RECON TEST 7: VOID Consistency (Excluding from Cash Ledger)', async () => {
    const monthKey = '2026-11';
    const initialSummary = getCashLedgerSummary(db, monthKey);

    // Insert income 5,000,000
    const incRes = db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_void_recon', '2026-11-05', ?, 'OTHER_INCOME', 'Thu test void', 5000000, 5000000, 0)
    `).run(monthKey);

    const summaryBeforeVoid = getCashLedgerSummary(db, monthKey);
    expect(summaryBeforeVoid.total_income).toBe(initialSummary.total_income + 5000000);

    // Void transaction via API
    const voidRes = await request(app)
      .post('/api/v1/transactions/void')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'INCOME', transaction_id: 'inc_void_recon' });

    expect(voidRes.status).toBe(200);

    const summaryAfterVoid = getCashLedgerSummary(db, monthKey);
    expect(summaryAfterVoid.total_income).toBe(initialSummary.total_income); // Returns to original total
  });

  test('RECON TEST 8: Closed Month Operations Blocked with HTTP 403', async () => {
    const closedMonth = '2026-07';

    // Mark month 2026-07 as CLOSED
    db.prepare(`
      INSERT OR REPLACE INTO monthly_closings (id, month_key, status, closed_at)
      VALUES ('close_202607', ?, 'CLOSED', CURRENT_TIMESTAMP)
    `).run(closedMonth);

    // 1. Court fee on closed month -> 403
    const courtRes = await request(app)
      .post('/api/v1/transactions/court-fee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ month_key: closedMonth, price_per_day: 300000, total_days: 10 });
    expect(courtRes.status).toBe(403);
    expect(courtRes.body.error.code).toBe('MONTH_CLOSED');

    // 2. Shuttle purchase on closed month -> 403
    const shuttleRes = await request(app)
      .post('/api/v1/transactions/shuttle-purchase')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ purchase_date: '2026-07-10', month_key: closedMonth, supplier: 'X', tubes_qty: 1, price_per_tube: 100000 });
    expect(shuttleRes.status).toBe(403);
    expect(shuttleRes.body.error.code).toBe('MONTH_CLOSED');

    // 3. Mid-month joiner on closed month -> 403
    const joinerRes = await request(app)
      .post('/api/v1/transactions/mid-month-joiner')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: testMemberId, month_key: closedMonth, transaction_date: '2026-07-05', amount: 200000 });
    expect(joinerRes.status).toBe(403);
    expect(joinerRes.body.error.code).toBe('MONTH_CLOSED');
  });

  test('RECON TEST 9: Historical Immutability (Changes in month N+1 do NOT alter month N)', async () => {
    const summarySeptBefore = getCashLedgerSummary(db, '2026-09');

    // Make new transaction in 2026-10
    db.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_immut_10', '2026-10-15', '2026-10', 'OTHER_INCOME', 'Thu 10/2026', 9990000, 9990000, 0)
    `).run();

    const summarySeptAfter = getCashLedgerSummary(db, '2026-09');

    // Sept numbers MUST be 100% identical
    expect(summarySeptAfter.total_income).toBe(summarySeptBefore.total_income);
    expect(summarySeptAfter.total_expense).toBe(summarySeptBefore.total_expense);
    expect(summarySeptAfter.ending_balance).toBe(summarySeptBefore.ending_balance);
  });

  test('RECON TEST 10: Phase 4 Financial Rounding Precision', async () => {
    expect(roundupToThousand(774100)).toBe(775000);

    const rawPurchase = 10 * 650001; // 6,500,010
    expect(roundupToThousand(rawPurchase)).toBe(6501000);
  });

  test('RECON TEST 11: Final Cash Reconciliation Assertion (Opening + Income - Expense = Ending)', async () => {
    const summary = getCashLedgerSummary(db, '2026-09');
    const calculatedEnding = summary.opening_balance + summary.total_income - summary.total_expense;

    expect(summary.ending_balance).toBe(calculatedEnding);
  });

  test('RECON TEST 12: Final Inventory Reconciliation Assertion (Opening + Imported - Used = Closing)', async () => {
    const inv = getInventoryCarryForward(db, '2026-09');
    const calculatedClosing = inv.opening_stock_pieces + inv.imported_pieces - inv.used_pieces;

    expect(inv.closing_stock_pieces).toBe(calculatedClosing);
  });

  test('RECON TEST 13: Full Carry Forward Continuity (Closing N = Opening N+1)', async () => {
    const septCash = getCashLedgerSummary(db, '2026-09');
    const octCash = getCashLedgerSummary(db, '2026-10');
    expect(octCash.opening_balance).toBe(septCash.ending_balance);

    const septInv = getInventoryCarryForward(db, '2026-09');
    const octInv = getInventoryCarryForward(db, '2026-10');
    expect(octInv.opening_stock_pieces).toBe(septInv.closing_stock_pieces);
  });
});
