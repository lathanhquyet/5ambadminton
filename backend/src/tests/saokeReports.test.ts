import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { recordOtherIncome, recordOtherExpense, recordShuttlePurchase } from '../services/cashLedgerService';
import { addVisitorToSession } from '../services/visitorFeeService';
import { recordMemberPayment } from '../services/feeEngine';

describe('TASK 6.9 — SAO KÊ REPORTS & STATISTICS TEST SUITE', () => {
  let db: any;
  let app: any;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    runSeed(db);
    app = createApp(db);

    // Seed test members
    db.prepare(`
      INSERT INTO members (id, full_name, member_type, status, joined_date)
      VALUES 
        ('mem_fixed_1', 'A Thông', 'FIXED', 'ACTIVE', '2026-01-01'),
        ('mem_fixed_2', 'A Nguyên', 'FIXED', 'ACTIVE', '2026-01-01'),
        ('mem_visitor_1', 'Dũng', 'VISITOR', 'ACTIVE', '2026-10-01')
    `).run();
  });

  afterEach(() => {
    if (db) db.close();
  });

  // =========================================================================
  // REPORT #1 — DANH SÁCH ĐÓNG QUỸ
  // =========================================================================
  describe('Report #1 — Fund Payment Report', () => {
    test('1. Monthly & Yearly aggregation with DESC sorting and PAID filtering', async () => {
      // Record payment for A Thông (800,000)
      recordOtherIncome(db, {
        transactionDate: '2026-10-05',
        monthKey: '2026-10',
        description: 'Đóng quỹ A Thông',
        amount: 800000,
        userId: 'usr_admin_default'
      });
      // Link member_id to income transaction
      db.prepare("UPDATE income_transactions SET member_id = 'mem_fixed_1' WHERE description = 'Đóng quỹ A Thông'").run();

      // Record payment for A Nguyên (760,000)
      recordOtherIncome(db, {
        transactionDate: '2026-10-06',
        monthKey: '2026-10',
        description: 'Đóng quỹ A Nguyên',
        amount: 760000,
        userId: 'usr_admin_default'
      });
      db.prepare("UPDATE income_transactions SET member_id = 'mem_fixed_2' WHERE description = 'Đóng quỹ A Nguyên'").run();

      // Query Monthly Report
      const resMonth = await request(app).get('/api/v1/public/saoke/reports/fund-payments?month=2026-10');
      expect(resMonth.status).toBe(200);
      expect(resMonth.body.data.items.length).toBe(2);

      // Verify DESC sorting: A Thông (800k) > A Nguyên (760k)
      expect(resMonth.body.data.items[0].full_name).toBe('A Thông');
      expect(resMonth.body.data.items[0].paid_amount).toBe(800000);
      expect(resMonth.body.data.items[1].full_name).toBe('A Nguyên');
      expect(resMonth.body.data.items[1].paid_amount).toBe(760000);
      expect(resMonth.body.data.summary.total_collected).toBe(1560000);

      // Query Yearly Report
      const resYear = await request(app).get('/api/v1/public/saoke/reports/fund-payments?year=2026');
      expect(resYear.status).toBe(200);
      expect(resYear.body.data.summary.total_collected).toBe(1560000);
    });

    test('2. Visitor confirmed payment included, unpaid visitor excluded', async () => {
      const visitorId = 'mem_visitor_1';

      // Create session
      db.prepare("INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('sess_1', '2026-10-01', '2026-10', 'COMPLETED')").run();
      addVisitorToSession(db, { sessionId: 'sess_1', memberId: visitorId, amount: 50000 });

      // Before payment confirmation: report should NOT include Dũng
      const resBefore = await request(app).get('/api/v1/public/saoke/reports/fund-payments?month=2026-10');
      expect(resBefore.body.data.items.find((i: any) => i.member_id === visitorId)).toBeUndefined();

      // Confirm Visitor payment
      recordMemberPayment(db, {
        memberId: visitorId,
        monthKey: '2026-10',
        paymentDate: '2026-10-02',
        amount: 50000
      });

      // After payment confirmation: report MUST include Dũng
      const resAfter = await request(app).get('/api/v1/public/saoke/reports/fund-payments?month=2026-10');
      const visitorItem = resAfter.body.data.items.find((i: any) => i.member_id === visitorId);
      expect(visitorItem).toBeDefined();
      expect(visitorItem.paid_amount).toBe(50000);
    });
  });

  // =========================================================================
  // REPORT #2 — DANH SÁCH KHOẢN CHI
  // =========================================================================
  describe('Report #2 — Expense Report', () => {
    test('1. Expense categorized and sorted DESC by total_amount', async () => {
      // Court fee 2,400,000
      db.prepare(`
        INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount)
        VALUES ('exp_1', '2026-10-01', '2026-10', 'COURT_FEE', 'Tien san 10/2026', 2400000, 2400000)
      `).run();

      // Shuttle purchase 3,360,000
      db.prepare(`
        INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount)
        VALUES ('exp_2', '2026-10-02', '2026-10', 'SHUTTLE_PURCHASE', 'Mua cau 10/2026', 3360000, 3360000)
      `).run();

      // Other expense 500,000
      recordOtherExpense(db, {
        transactionDate: '2026-10-03',
        monthKey: '2026-10',
        description: 'Chi khac',
        amount: 500000
      });

      const res = await request(app).get('/api/v1/public/saoke/reports/expenses?month=2026-10');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(3);

      // Verify DESC sorting: Phí cầu (3.36M) > Phí sân (2.4M) > Phí khác (500k)
      expect(res.body.data.items[0].category_name).toBe('Phí cầu');
      expect(res.body.data.items[0].total_amount).toBe(3360000);
      expect(res.body.data.items[1].category_name).toBe('Phí sân');
      expect(res.body.data.items[1].total_amount).toBe(2400000);
      expect(res.body.data.items[2].category_name).toBe('Phí khác');
      expect(res.body.data.items[2].total_amount).toBe(500000);

      expect(res.body.data.summary.total_expense).toBe(6260000);
    });
  });

  // =========================================================================
  // REPORT #3 — SỐ BUỔI CHƠI CỦA THÀNH VIÊN
  // =========================================================================
  describe('Report #3 — Member Attendance Report', () => {
    test('1. Member sessions count for Fixed and Visitor without duplicate counting', async () => {
      // Session 1: A Thông & A Nguyên present
      db.prepare("INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('s1', '2026-10-01', '2026-10', 'COMPLETED')").run();
      db.prepare("INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm1', 's1', 'mem_fixed_1', 'PRESENT')").run();
      db.prepare("INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm2', 's1', 'mem_fixed_2', 'PRESENT')").run();

      // Session 2: A Thông & Visitor Dũng present
      db.prepare("INSERT INTO playing_sessions (id, session_date, month_key, status) VALUES ('s2', '2026-10-02', '2026-10', 'COMPLETED')").run();
      db.prepare("INSERT INTO playing_session_members (id, session_id, member_id, attendance_status) VALUES ('psm3', 's2', 'mem_fixed_1', 'PRESENT')").run();
      addVisitorToSession(db, { sessionId: 's2', memberId: 'mem_visitor_1', amount: 50000 });

      const res = await request(app).get('/api/v1/public/saoke/reports/attendance?month=2026-10');
      expect(res.status).toBe(200);

      // Verify DESC sorting: A Thông (2 sessions) > A Nguyên (1 session) = Dũng (1 session)
      expect(res.body.data.items[0].full_name).toBe('A Thông');
      expect(res.body.data.items[0].session_count).toBe(2);
      expect(res.body.data.summary.total_player_sessions).toBe(4);
    });
  });

  // =========================================================================
  // REPORT #4 — SỐ QUẢ CẦU SỬ DỤNG
  // =========================================================================
  describe('Report #4 — Shuttle Usage Report', () => {
    test('1. Shuttle usage recorded only from USAGE transactions (excludes purchases)', async () => {
      // Record shuttle purchase (should NOT be counted as usage)
      recordShuttlePurchase(db, {
        purchaseDate: '2026-10-01',
        monthKey: '2026-10',
        supplier: 'Shop Cau Long',
        tubesQty: 10,
        pricePerTube: 650000
      });

      // Record actual usage on 2026-10-01 (10 pieces) and 2026-10-03 (5 pieces)
      db.prepare(`
        INSERT INTO inventory_transactions (id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces)
        VALUES 
          ('use_1', '2026-10-01', '2026-10', 'prod_tc77', 'USAGE', -10),
          ('use_2', '2026-10-03', '2026-10', 'prod_tc77', 'USAGE', -5)
      `).run();

      const resDaily = await request(app).get('/api/v1/public/saoke/reports/shuttle-usage?period_type=DAILY&month=2026-10');
      expect(resDaily.status).toBe(200);
      expect(resDaily.body.data.items.length).toBe(2);

      // Verify DESC sorting by shuttle_pieces: 2026-10-01 (10 pieces) > 2026-10-03 (5 pieces)
      expect(resDaily.body.data.items[0].period_label).toBe('2026-10-01');
      expect(resDaily.body.data.items[0].shuttle_pieces).toBe(10);
      expect(resDaily.body.data.items[1].period_label).toBe('2026-10-03');
      expect(resDaily.body.data.items[1].shuttle_pieces).toBe(5);

      expect(resDaily.body.data.summary.total_shuttle_pieces).toBe(15);
    });
  });
});
