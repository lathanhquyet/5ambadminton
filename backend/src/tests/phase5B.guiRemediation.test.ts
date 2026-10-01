import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { calculateMonthlyFixedFees } from '../services/feeEngine';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-5am-badminton';

function generateTestToken(role: 'ADMIN' | 'MEMBER', userId = 'test_user_id') {
  return jwt.sign({ userId, username: 'testuser', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Phase 5B — GUI Remediation: Financial Operations, Dashboard & History', () => {
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

  describe('1. Exact Amount Preservation (No Rounding for Manual Transactions)', () => {
    it('should record exact visitor fee (37,500) without rounding', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/visitor-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-15',
          month_key: '2026-09',
          payer_name: 'Khách vãng lai A',
          amount: 37500,
          payment_method: 'CASH'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(37500);

      // Verify exact stored in DB
      const row = db.prepare('SELECT original_amount, rounded_amount FROM income_transactions WHERE id = ?').get(res.body.data.incomeTransactionId);
      expect(row.original_amount).toBe(37500);
      expect(row.rounded_amount).toBe(37500);
    });

    it('should record exact other income (123,456) without rounding', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/other-income')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-16',
          month_key: '2026-09',
          description: 'Thu thanh lý đồ cũ',
          amount: 123456,
          payment_method: 'BANK_TRANSFER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const row = db.prepare('SELECT original_amount, rounded_amount FROM income_transactions WHERE id = ?').get(res.body.data.incomeTransactionId);
      expect(row.original_amount).toBe(123456);
      expect(row.rounded_amount).toBe(123456);
    });

    it('should record exact court fee expense (1,234,567) without rounding', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/other-expense')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-17',
          month_key: '2026-09',
          description: 'Phí thuê sân tháng 09',
          recipient: 'Chủ sân Badminton',
          amount: 1234567,
          payment_method: 'BANK_TRANSFER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const row = db.prepare('SELECT original_amount, rounded_amount FROM expense_transactions WHERE id = ?').get(res.body.data.expenseTransactionId);
      expect(row.original_amount).toBe(1234567);
      expect(row.rounded_amount).toBe(1234567);
    });
  });

  describe('2. Validation & Invalid Payload Protection', () => {
    it('should reject amount <= 0 for visitor fee with 400', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/visitor-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-15',
          month_key: '2026-09',
          amount: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const count = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions WHERE category = \'VISITOR_FEE\'').get().cnt;
      expect(count).toBe(0);
    });

    it('should reject negative amount for other expense with 400', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/other-expense')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-15',
          month_key: '2026-09',
          description: 'Chi vô lý',
          amount: -50000
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin request with 403', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/visitor-fee')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          transaction_date: '2026-09-15',
          month_key: '2026-09',
          amount: 50000
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Unified Transaction History API', () => {
    beforeEach(async () => {
      // Create sample income and expense transactions
      await request(app)
        .post('/api/v1/transactions/visitor-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-10',
          month_key: '2026-09',
          payer_name: 'Khách A',
          amount: 50000
        });

      await request(app)
        .post('/api/v1/transactions/other-expense')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-12',
          month_key: '2026-09',
          description: 'Mua nước uống',
          recipient: 'Cửa hàng tiện lợi',
          amount: 45000
        });
    });

    it('should fetch unified transaction history containing both income & expense', async () => {
      const res = await request(app)
        .get('/api/v1/transactions/history?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.items.length).toBe(2);

      const types = data.items.map((i: any) => i.type);
      expect(types).toContain('INCOME');
      expect(types).toContain('EXPENSE');
    });

    it('should filter transaction history by type = INCOME', async () => {
      const res = await request(app)
        .get('/api/v1/transactions/history?month=2026-09&type=INCOME')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].type).toBe('INCOME');
    });
  });

  describe('4. Dashboard Report Data Integrations', () => {
    it('should include outstandingDebt in backend dashboard report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const financial = res.body.data.financial;
      expect(financial).toHaveProperty('outstandingDebt');
      expect(financial.outstandingDebt).toBe(700000);
    });
  });

  describe('5. Financial Category Remediation (Court Fee Category Mapping)', () => {
    it('TEST 1 & 6: Creating court fee expense voucher persists category COURT_FEE with exact amount (1,510,000)', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-28',
          month_key: '2026-09',
          description: 'Chi phí thuê sân tháng 2026-09',
          recipient: 'Chủ sân cầu lông',
          amount: 1510000,
          payment_method: 'BANK_TRANSFER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const expTxId = res.body.data.expenseTransactionId;
      const row = db.prepare('SELECT category, description, original_amount, rounded_amount FROM expense_transactions WHERE id = ?').get(expTxId);
      expect(row.category).toBe('COURT_FEE');
      expect(row.category).not.toBe('OTHER_EXPENSE');
      expect(row.original_amount).toBe(1510000);
      expect(row.rounded_amount).toBe(1510000);
    });

    it('TEST 2 & 10: Creating shuttle purchase expense voucher persists category SHUTTLE_PURCHASE', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/shuttle-purchase')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchase_date: '2026-09-20',
          month_key: '2026-09',
          supplier: 'Đại lý Yonex',
          tubes_qty: 10,
          price_per_tube: 250000
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const expTxId = res.body.data.expenseTransactionId;
      const row = db.prepare('SELECT category, rounded_amount FROM expense_transactions WHERE id = ?').get(expTxId);
      expect(row.category).toBe('SHUTTLE_PURCHASE');
      expect(row.rounded_amount).toBe(2500000);
    });

    it('TEST 3 & 9: Creating other expense voucher persists category OTHER_EXPENSE', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/other-expense')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-22',
          month_key: '2026-09',
          description: 'Sửa chìa khóa tủ đồ',
          recipient: 'Thợ khóa',
          amount: 150000
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const expTxId = res.body.data.expenseTransactionId;
      const row = db.prepare('SELECT category, rounded_amount FROM expense_transactions WHERE id = ?').get(expTxId);
      expect(row.category).toBe('OTHER_EXPENSE');
      expect(row.rounded_amount).toBe(150000);
    });

    it('TEST 4: COURT_FEE appears with categoryLabel "Phí sân" in Transaction History API', async () => {
      await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-28',
          month_key: '2026-09',
          description: 'Chi phí thuê sân tháng 2026-09',
          recipient: 'Chủ sân cầu lông',
          amount: 1510000,
          payment_method: 'BANK_TRANSFER'
        });

      const historyRes = await request(app)
        .get('/api/v1/transactions/history?month=2026-09&category=COURT_FEE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.items.length).toBe(1);
      const item = historyRes.body.data.items[0];
      expect(item.category).toBe('COURT_FEE');
      expect(item.categoryLabel).toBe('Phí sân');
      expect(item.expenseAmount).toBe(1510000);
    });

    it('TEST 5, 7: COURT_FEE aggregates under COURT_FEE in Dashboard & Cash Ledger expense breakdown', async () => {
      await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-28',
          month_key: '2026-09',
          description: 'Chi phí thuê sân tháng 2026-09',
          recipient: 'Chủ sân cầu lông',
          amount: 3020000,
          payment_method: 'BANK_TRANSFER'
        });

      const reportRes = await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportRes.status).toBe(200);
      const expBreakdown = reportRes.body.data.expenseBreakdown;
      expect(expBreakdown.COURT_FEE.amount).toBe(3020000);
      expect(expBreakdown.COURT_FEE.percentage).toBe(100);
      expect(expBreakdown.OTHER_EXPENSE.amount).toBe(0);
      expect(expBreakdown.SHUTTLE_PURCHASE.amount).toBe(0);

      const ledgerRes = await request(app)
        .get('/api/v1/transactions/ledger-summary?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(ledgerRes.status).toBe(200);
      const ledgerBreakdown = ledgerRes.body.data.cash_ledger.expense_breakdown;
      expect(ledgerBreakdown.court_fee).toBe(3020000);
      expect(ledgerBreakdown.other_expense).toBe(0);
    });

    it('TEST 8: Idempotency / config creation idempotency works without creating duplicate entries', async () => {
      const res1 = await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month_key: '2026-09',
          price_per_day: 100000,
          total_days: 10,
          total_courts: 2
        });

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month_key: '2026-09',
          price_per_day: 100000,
          total_days: 10,
          total_courts: 2
        });

      expect(res2.status).toBe(200);

      const count = db.prepare('SELECT COUNT(*) as cnt FROM expense_transactions WHERE category = \'COURT_FEE\' AND reference_type = \'COURT_FEE\'').get().cnt;
      expect(count).toBe(1);
    });
  });

  describe('6. Visitor Fee Session Creation Financial Remediation', () => {
    it('TEST 1, 2, 3, 4, 5 & 9: Create session with visitor (60,000, paid=true) creates 1 VISITOR_FEE income, 1 ledger entry, appears in History & Dashboard', async () => {
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-09-28',
          notes: 'Buổi chơi có khách vãng lai',
          visitor: {
            full_name: 'Anh Thông 3',
            amount: 60000,
            is_paid: true
          }
        });

      expect(createRes.status).toBe(201);

      // Verify income_transactions record
      const incRows = db.prepare("SELECT * FROM income_transactions WHERE category = 'VISITOR_FEE' AND month_key = '2026-09'").all();
      expect(incRows.length).toBe(1);
      expect(incRows[0].rounded_amount).toBe(60000);

      // Verify Cash Ledger summary
      const ledgerRes = await request(app)
        .get('/api/v1/transactions/ledger-summary?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ledgerRes.body.data.cash_ledger.income_breakdown.visitor_fee).toBe(60000);

      // Verify Transaction History API
      const historyRes = await request(app)
        .get('/api/v1/transactions/history?month=2026-09&category=VISITOR_FEE')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.items.length).toBe(1);
      const item = historyRes.body.data.items[0];
      expect(item.type).toBe('INCOME');
      expect(item.category).toBe('VISITOR_FEE');
      expect(item.categoryLabel).toBe('Phí vãng lai');
      expect(item.incomeAmount).toBe(60000);
      expect(item.payerOrRecipient).toBe('Anh Thông 3');

      // Verify Dashboard Report API
      const reportRes = await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reportRes.body.data.incomeBreakdown.VISITOR_FEE.amount).toBe(60000);
    });

    it('TEST 6: Create session with visitor (60,000, paid=false) creates NO income transaction or ledger entry', async () => {
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-09-29',
          notes: 'Buổi chơi chưa thu tiền vãng lai',
          visitor: {
            full_name: 'Khách Chưa Trả',
            amount: 60000,
            is_paid: false
          }
        });

      expect(createRes.status).toBe(201);

      const incRows = db.prepare("SELECT * FROM income_transactions WHERE category = 'VISITOR_FEE' AND description LIKE '%Khách Chưa Trả%'").all();
      expect(incRows.length).toBe(0);

      const ledgerRes = await request(app)
        .get('/api/v1/transactions/ledger-summary?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ledgerRes.body.data.cash_ledger.income_breakdown.visitor_fee).toBe(0);
    });

    it('TEST 7 & 8: Later payment confirmation creates exactly ONE VISITOR_FEE transaction & retry does not duplicate', async () => {
      // 1. Create session with UNPAID visitor
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-09-25',
          visitor: {
            full_name: 'Anh Cường Vãng Lai',
            amount: 77777,
            is_paid: false
          }
        });

      expect(sessionRes.status).toBe(201);

      const feeRow = db.prepare("SELECT * FROM session_visitor_fees WHERE amount = 77777").get();
      expect(feeRow.status).toBe('UNPAID');

      // 2. Mark visitor fee as PAID
      const payRes1 = await request(app)
        .post(`/api/v1/sessions/visitor-fees/${feeRow.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_method: 'CASH' });

      expect(payRes1.status).toBe(200);

      const incRows1 = db.prepare("SELECT * FROM income_transactions WHERE category = 'VISITOR_FEE' AND rounded_amount = 77777").all();
      expect(incRows1.length).toBe(1);

      // 3. Retry mark visitor fee as PAID (Idempotency)
      const payRes2 = await request(app)
        .post(`/api/v1/sessions/visitor-fees/${feeRow.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_method: 'CASH' });

      expect(payRes2.status).toBe(200);

      const incRows2 = db.prepare("SELECT * FROM income_transactions WHERE category = 'VISITOR_FEE' AND rounded_amount = 77777").all();
      expect(incRows2.length).toBe(1); // STILL EXACTLY ONE
    });

    it('TEST 10: Reject negative amount for visitor fee with 400', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-09-27',
          visitor: {
            full_name: 'Khách Lỗi',
            amount: -50000,
            is_paid: true
          }
        });

      expect(res.status).toBe(400);
    });

    it('TEST 11 & 12: Manual POST /api/v1/transactions/visitor-fee works and uses the same VISITOR_FEE category', async () => {
      const manualRes = await request(app)
        .post('/api/v1/transactions/visitor-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transaction_date: '2026-09-26',
          month_key: '2026-09',
          payer_name: 'Khách Thủ Công',
          amount: 123456,
          payment_method: 'CASH'
        });

      expect(manualRes.status).toBe(201);

      const row = db.prepare('SELECT category, rounded_amount FROM income_transactions WHERE id = ?').get(manualRes.body.data.incomeTransactionId);
      expect(row.category).toBe('VISITOR_FEE');
      expect(row.rounded_amount).toBe(123456);
    });
  });

  describe('7. Visitor Fee Payment Status in Member Debt Table Remediation', () => {
    it('TEST 1 & 4 & 5 & 7 & 8: Visitor fee = 60,000, is_paid = true reflects required=60,000, paid=60,000, remaining=0, status=PAID in debt table API', async () => {
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-01',
          visitor: {
            full_name: 'Anh Thông 3',
            amount: 60000,
            is_paid: true
          }
        });
      expect(sessionRes.status).toBe(201);

      // Check GET /api/v1/debts?month=2026-10
      const debtRes = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(debtRes.status).toBe(200);
      expect(debtRes.body.success).toBe(true);
      const debts = debtRes.body.data;
      const visitorDebt = debts.find((d: any) => d.member_name === 'Anh Thông 3');
      expect(visitorDebt).toBeDefined();
      expect(visitorDebt.member_type).toBe('VISITOR');
      expect(visitorDebt.total_fee_required).toBe(60000);
      expect(visitorDebt.paid_amount).toBe(60000);
      expect(visitorDebt.remaining_amount).toBe(0);
      expect(visitorDebt.status).toBe('PAID');

      // TEST 4: Exactly one VISITOR_FEE income transaction
      const incCount = db.prepare("SELECT COUNT(*) as cnt FROM income_transactions WHERE category = 'VISITOR_FEE' AND month_key = '2026-10'").get().cnt;
      expect(incCount).toBe(1);

      // TEST 5: Exactly one Cash Ledger entry reflected in ledger-summary
      const ledgerRes = await request(app)
        .get('/api/v1/transactions/ledger-summary?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ledgerRes.body.data.cash_ledger.income_breakdown.visitor_fee).toBe(60000);

      // TEST 7: Transaction History includes +60,000 VISITOR_FEE
      const historyRes = await request(app)
        .get('/api/v1/transactions/history?month=2026-10&category=VISITOR_FEE')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(historyRes.body.data.items.length).toBe(1);
      expect(historyRes.body.data.items[0].incomeAmount).toBe(60000);

      // TEST 8: Dashboard report includes visitor fee income 60,000
      const reportRes = await request(app)
        .get('/api/v1/reports/monthly?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reportRes.body.data.incomeBreakdown.VISITOR_FEE.amount).toBe(60000);
    });

    it('TEST 2: Visitor fee = 60,000, is_paid = false reflects required=60,000, paid=0, remaining=60,000, status=UNPAID in debt table API', async () => {
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-02',
          visitor: {
            full_name: 'Khách Chưa Trả 10',
            amount: 60000,
            is_paid: false
          }
        });
      expect(sessionRes.status).toBe(201);

      const debtRes = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      const visitorDebt = debtRes.body.data.find((d: any) => d.member_name === 'Khách Chưa Trả 10');
      expect(visitorDebt).toBeDefined();
      expect(visitorDebt.total_fee_required).toBe(60000);
      expect(visitorDebt.paid_amount).toBe(0);
      expect(visitorDebt.remaining_amount).toBe(60000);
      expect(visitorDebt.status).toBe('UNPAID');
    });

    it('TEST 3 & 6: Later payment confirmation updates debt table to PAID and retry is idempotent', async () => {
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-03',
          visitor: {
            full_name: 'Khách Trả Sau',
            amount: 60000,
            is_paid: false
          }
        });
      expect(sessionRes.status).toBe(201);

      const feeRow = db.prepare("SELECT svf.* FROM session_visitor_fees svf JOIN members m ON m.id = svf.member_id WHERE m.full_name = 'Khách Trả Sau'").get();
      expect(feeRow.status).toBe('UNPAID');

      // Mark payment confirmed
      const payRes1 = await request(app)
        .post(`/api/v1/sessions/visitor-fees/${feeRow.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_method: 'CASH' });
      expect(payRes1.status).toBe(200);

      // Verify Debt table updated
      let debtRes = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);
      let visitorDebt = debtRes.body.data.find((d: any) => d.member_name === 'Khách Trả Sau');
      expect(visitorDebt.total_fee_required).toBe(60000);
      expect(visitorDebt.paid_amount).toBe(60000);
      expect(visitorDebt.remaining_amount).toBe(0);
      expect(visitorDebt.status).toBe('PAID');

      // Retry payment (TEST 6)
      const payRes2 = await request(app)
        .post(`/api/v1/sessions/visitor-fees/${feeRow.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_method: 'CASH' });
      expect(payRes2.status).toBe(200);

      const incCount = db.prepare("SELECT COUNT(*) as cnt FROM income_transactions WHERE category = 'VISITOR_FEE' AND description LIKE '%Khách Trả Sau%'").get().cnt;
      expect(incCount).toBe(1);
    });

    it('TEST 9: Preserves exact non-rounded visitor fee amounts in debt table (37,500, 77,777, 123,456)', async () => {
      await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-04',
          visitor: {
            full_name: 'Khách Lẻ Exact',
            amount: 77777,
            is_paid: true
          }
        });

      const debtRes = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      const visitorDebt = debtRes.body.data.find((d: any) => d.member_name === 'Khách Lẻ Exact');
      expect(visitorDebt.total_fee_required).toBe(77777);
      expect(visitorDebt.paid_amount).toBe(77777);
      expect(visitorDebt.remaining_amount).toBe(0);
      expect(visitorDebt.status).toBe('PAID');
    });

    it('TEST 10: Fixed member debt/payment behavior remains unchanged', async () => {
      const debtRes = await request(app)
        .get('/api/v1/debts?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(debtRes.status).toBe(200);
      const fixedMemberDebt = debtRes.body.data.find((d: any) => d.member_id === 'mem_01');
      expect(fixedMemberDebt).toBeDefined();
      expect(fixedMemberDebt.member_type).toBe('FIXED');
      expect(fixedMemberDebt.total_fee_required).toBeGreaterThan(0);
    });

    it('TEST 11: Visitor with fee = 0 is UNPAID and does NOT create a paid financial transaction', async () => {
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-05',
          visitor: {
            full_name: 'Khách Miễn Phí',
            amount: 0,
            is_paid: false
          }
        });

      expect(sessionRes.status).toBe(201);

      const debtRes = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);

      const visitorDebt = debtRes.body.data.find((d: any) => d.member_name === 'Khách Miễn Phí');
      expect(visitorDebt).toBeDefined();
      expect(visitorDebt.total_fee_required).toBe(0);
      expect(visitorDebt.paid_amount).toBe(0);
      expect(visitorDebt.remaining_amount).toBe(0);
      expect(visitorDebt.status).toBe('UNPAID');

      const incCount = db.prepare("SELECT COUNT(*) as cnt FROM income_transactions WHERE description LIKE '%Khách Miễn Phí%'").get().cnt;
      expect(incCount).toBe(0);
    });

    it('TEST 12: Session date 2026-10-01 belongs to month 2026-10 and not 2026-09', async () => {
      await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: '2026-10-01',
          visitor: {
            full_name: 'Khách Đầu Tháng 10',
            amount: 50000,
            is_paid: true
          }
        });

      const septDebt = await request(app)
        .get('/api/v1/debts?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
      const septVisitor = septDebt.body.data.find((d: any) => d.member_name === 'Khách Đầu Tháng 10');
      expect(septVisitor ? septVisitor.total_fee_required : 0).toBe(0);

      const octDebt = await request(app)
        .get('/api/v1/debts?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`);
      const octVisitor = octDebt.body.data.find((d: any) => d.member_name === 'Khách Đầu Tháng 10');
      expect(octVisitor).toBeDefined();
      expect(octVisitor.total_fee_required).toBe(50000);
      expect(octVisitor.paid_amount).toBe(50000);
      expect(octVisitor.status).toBe('PAID');
    });
  });
});

