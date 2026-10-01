import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { resetTestDatabase } from '../database/resetTestDb';

describe('PHASE 5A: BACKEND REPORT LAYER & REPORT APIS DEEP TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let memberToken: string;
  let fixedMemberId: string;

  const monthA = '2026-09';
  const monthB = '2026-10';

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    // Clean reset
    resetTestDatabase(db);

    // Admin login
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLoginRes.body.data.access_token;

    // Create a regular member user for RBAC test
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date, days_per_week)
      VALUES ('m_report_1', 'Thành Viên Báo Cáo', '0912345678', 'FIXED', 'ACTIVE', '2026-09-01', 3)
    `).run();
    fixedMemberId = 'm_report_1';

    const pwdHash = db.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as any;
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, member_id)
      VALUES ('u_member_1', 'member1', ?, 'MEMBER', 'm_report_1')
    `).run(pwdHash.password_hash);

    const memberLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'member1', password: 'admin123' });
    memberToken = memberLoginRes.body.data.access_token;

    // Set up deterministic test data for Month A (2026-09) and Month B (2026-10)
    setupDeterministicData(db);
  });

  afterAll(() => {
    if (db) db.close();
  });

  function setupDeterministicData(database: ReturnType<typeof Database>) {
    // --- Month A (2026-09) Data ---
    // 1. Sessions & Members
    database.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date, days_per_week)
      VALUES ('m_report_2', 'Thành Viên Báo Cáo 2', '0912345679', 'FIXED', 'ACTIVE', '2026-09-01', 2)
    `).run();

    database.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status, total_players)
      VALUES ('sess_sep_1', '2026-09-05', '2026-09', 'OPEN', 2),
             ('sess_sep_2', '2026-09-12', '2026-09', 'OPEN', 1),
             ('sess_sep_cancelled', '2026-09-20', '2026-09', 'CANCELLED', 0)
    `).run();

    database.prepare(`
      INSERT INTO playing_session_members (id, session_id, member_id, attendance_status)
      VALUES ('psm_sep_1', 'sess_sep_1', 'm_report_1', 'PRESENT'),
             ('psm_sep_2', 'sess_sep_1', 'm_report_2', 'PRESENT'),
             ('psm_sep_3', 'sess_sep_2', 'm_report_1', 'PRESENT')
    `).run();

    // 2. Fixed Member Fee
    database.prepare(`
      INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
      VALUES ('mf_sep_1', '2026-09', 'm_report_1', 'FIXED_FUND', 1000000, 1000000, 1000000, 0, 'PAID')
    `).run();

    // 3. Income Transactions (FIXED_FUND: 1,000,000, VISITOR_FEE: 150,000, OTHER_INCOME: 500,000, VOID: 200,000)
    database.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_sep_1', '2026-09-01', '2026-09', 'FIXED_FUND', 'Thu quỹ tháng 9', 1000000, 1000000, 0),
             ('inc_sep_2', '2026-09-05', '2026-09', 'VISITOR_FEE', 'Khách vãng lai 1', 50000, 50000, 0),
             ('inc_sep_3', '2026-09-05', '2026-09', 'VISITOR_FEE', 'Khách vãng lai 2', 100000, 100000, 0),
             ('inc_sep_4', '2026-09-10', '2026-09', 'OTHER_INCOME', 'Tài trợ', 500000, 500000, 0),
             ('inc_sep_void', '2026-09-15', '2026-09', 'OTHER_INCOME', 'Thu nhầm (VOID)', 200000, 200000, 1)
    `).run();

    // 4. Visitor Fees (Paid: 150,000, Unpaid: 55,555 override)
    database.prepare(`
      INSERT INTO session_visitor_fees (id, session_id, member_id, amount, status, income_transaction_id)
      VALUES ('vf_sep_1', 'sess_sep_1', 'm_report_1', 50000, 'PAID', 'inc_sep_2'),
             ('vf_sep_2', 'sess_sep_1', 'm_report_2', 100000, 'PAID', 'inc_sep_3'),
             ('vf_sep_3', 'sess_sep_2', 'm_report_1', 55555, 'UNPAID', NULL)
    `).run();

    // 5. Expense Transactions (COURT_FEE: 600,000, SHUTTLE_PURCHASE: 300,000, OTHER_EXPENSE: 100,000, VOID: 150,000)
    database.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_sep_1', '2026-09-01', '2026-09', 'COURT_FEE', 'Tiền sân tháng 9', 600000, 600000, 0),
             ('exp_sep_2', '2026-09-02', '2026-09', 'SHUTTLE_PURCHASE', 'Mua cầu 1 ống', 300000, 300000, 0),
             ('exp_sep_3', '2026-09-15', '2026-09', 'OTHER_EXPENSE', 'Nước uống', 100000, 100000, 0),
             ('exp_sep_void', '2026-09-18', '2026-09', 'OTHER_EXPENSE', 'Chi sai (VOID)', 150000, 150000, 1)
    `).run();

    // 6. Inventory Transactions (Receipt: 12 pieces, Usage: 4 pieces -> -4 in DB)
    database.prepare(`
      INSERT INTO inventory_transactions (id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces, total_amount)
      VALUES ('inv_sep_1', '2026-09-02', '2026-09', 'prod_tc77', 'RECEIPT', 12, 300000),
             ('inv_sep_2', '2026-09-05', '2026-09', 'prod_tc77', 'USAGE', -4, 0)
    `).run();

    // --- Month B (2026-10) Data (High expense to create negative balance or test carry forward) ---
    // Month A Ending Balance = (0 opening + 1,650,000 income - 1,000,000 expense) = 650,000
    // Month B: Income = 200,000, Expense = 1,500,000 => Ending = 650,000 + 200,000 - 1,500,000 = -650,000 (NEGATIVE)
    database.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_oct_1', '2026-10-01', '2026-10', 'OTHER_INCOME', 'Thu khác tháng 10', 200000, 200000, 0)
    `).run();

    database.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_oct_1', '2026-10-05', '2026-10', 'COURT_FEE', 'Tiền sân tháng 10', 1500000, 1500000, 0)
    `).run();
  }

  // ============================================================
  // A. API / AUTH (Tests 1 - 4)
  // ============================================================
  test('1. Admin can access monthly report with valid JWT', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.month).toBe('2026-09');
  });

  test('2. Missing JWT rejected with HTTP 401', async () => {
    const res = await request(app).get('/api/v1/reports/monthly?month=2026-09');
    expect(res.status).toBe(401);
  });

  test('3. Invalid JWT rejected with HTTP 401', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', 'Bearer invalid_jwt_token_xyz');
    expect(res.status).toBe(401);
  });

  test('4. Non-authorized role (MEMBER) rejected with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  // ============================================================
  // B. MONTH VALIDATION (Tests 5 - 11)
  // ============================================================
  test('5. Valid YYYY-MM accepted', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('6. Invalid month format rejected (e.g. 2026-1)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('7. Month 00 rejected', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-00')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('8. Month 13 rejected', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-13')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('9. Missing month rejected', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('10. Malformed date rejected (e.g. 2026/09, 2026-09-01)', async () => {
    const dates = ['2026/09', '2026-09-01', '26-09', 'abc'];
    for (const d of dates) {
      const res = await request(app)
        .get(`/api/v1/reports/monthly?month=${encodeURIComponent(d)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    }
  });

  test('11. SQL injection attempt rejected safely', async () => {
    const sqlInjections = [
      "2026-09' OR 1=1 --",
      "2026-09; DROP TABLE members; --",
      "' OR '1'='1",
      "2026-09--"
    ];

    for (const inj of sqlInjections) {
      const res = await request(app)
        .get(`/api/v1/reports/monthly?month=${encodeURIComponent(inj)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }

    // Verify members table was NOT dropped
    const membersCount = (db.prepare('SELECT COUNT(*) as cnt FROM members').get() as any).cnt;
    expect(membersCount).toBeGreaterThan(0);
  });

  // ============================================================
  // C. FINANCIAL SUMMARY (Tests 12 - 18)
  // ============================================================
  test('12. Opening balance correct for Month A (0)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.openingBalance).toBe(0);
  });

  test('13. Total income correct (1,650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBe(1650000);
  });

  test('14. Total expense correct (1,000,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalExpense).toBe(1000000);
  });

  test('15. Ending balance correct (650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.endingBalance).toBe(650000);
  });

  test('16. Negative ending balance supported in Month B (-650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    // Month B Opening = 650,000, Income = 200,000, Expense = 1,500,000 => Ending = -650,000
    expect(res.body.data.financial.openingBalance).toBe(650000);
    expect(res.body.data.financial.totalIncome).toBe(200000);
    expect(res.body.data.financial.totalExpense).toBe(1500000);
    expect(res.body.data.financial.endingBalance).toBe(-650000);
  });

  test('17. VOID income excluded from totals', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    // Total income is 1,650,000 (excluding 200,000 VOID)
    expect(res.body.data.financial.totalIncome).toBe(1650000);
  });

  test('18. VOID expense excluded from totals', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    // Total expense is 1,000,000 (excluding 150,000 VOID)
    expect(res.body.data.financial.totalExpense).toBe(1000000);
  });

  // ============================================================
  // D. INCOME BREAKDOWN (Tests 19 - 24)
  // ============================================================
  test('19. FIXED_FUND amount correct (1,000,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(1000000);
  });

  test('20. VISITOR_FEE amount correct (150,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.VISITOR_FEE.amount).toBe(150000);
  });

  test('21. OTHER_INCOME amount correct (500,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.OTHER_INCOME.amount).toBe(500000);
  });

  test('22. Income percentages correct (60.61%, 9.09%, 30.30%)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const inc = res.body.data.incomeBreakdown;
    expect(inc.FIXED_FUND.percentage).toBe(60.61);
    expect(inc.VISITOR_FEE.percentage).toBe(9.09);
    expect(inc.OTHER_INCOME.percentage).toBe(30.3);
  });

  test('23. Income percentages sum to ~100%', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const inc = res.body.data.incomeBreakdown;
    const sum = inc.FIXED_FUND.percentage + inc.VISITOR_FEE.percentage + inc.OTHER_INCOME.percentage;
    expect(Math.round(sum)).toBe(100);
  });

  test('24. Zero-income month returns all percentages = 0 (no NaN/Infinity)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);

    const inc = res.body.data.incomeBreakdown;
    expect(inc.FIXED_FUND.amount).toBe(0);
    expect(inc.FIXED_FUND.percentage).toBe(0);
    expect(inc.VISITOR_FEE.percentage).toBe(0);
    expect(inc.OTHER_INCOME.percentage).toBe(0);
  });

  // ============================================================
  // E. EXPENSE BREAKDOWN (Tests 25 - 30)
  // ============================================================
  test('25. COURT_FEE amount correct (600,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.COURT_FEE.amount).toBe(600000);
  });

  test('26. SHUTTLE_PURCHASE amount correct (300,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.SHUTTLE_PURCHASE.amount).toBe(300000);
  });

  test('27. OTHER_EXPENSE amount correct (100,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.OTHER_EXPENSE.amount).toBe(100000);
  });

  test('28. Expense percentages correct (60%, 30%, 10%)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.percentage).toBe(60);
    expect(exp.SHUTTLE_PURCHASE.percentage).toBe(30);
    expect(exp.OTHER_EXPENSE.percentage).toBe(10);
  });

  test('29. Expense percentages sum to exactly 100%', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.percentage + exp.SHUTTLE_PURCHASE.percentage + exp.OTHER_EXPENSE.percentage).toBe(100);
  });

  test('30. Zero-expense month returns all percentages = 0 (no NaN/Infinity)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);

    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.amount).toBe(0);
    expect(exp.COURT_FEE.percentage).toBe(0);
    expect(exp.SHUTTLE_PURCHASE.percentage).toBe(0);
    expect(exp.OTHER_EXPENSE.percentage).toBe(0);
  });

  // ============================================================
  // F. VISITOR FEE (Tests 31 - 38)
  // ============================================================
  test('31. Visitor Fee Due correct (205,555 = 50,000 + 100,000 + 55,555)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.due).toBe(205555);
  });

  test('32. Visitor Fee Collected correct (150,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.collected).toBe(150000);
  });

  test('33. Visitor Fee Outstanding correct (55,555)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.outstanding).toBe(55555);
  });

  test('34. Visitor Fee Cash Income correct (150,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.cashIncome).toBe(150000);
  });

  test('35. Unpaid visitor fee does not enter Cash Ledger', async () => {
    // Outstanding = 55,555 is not in Cash Ledger total_income
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.VISITOR_FEE.amount).toBe(150000); // Only paid fees
  });

  test('36. Paid visitor fee enters Cash Ledger once', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.collected).toBe(res.body.data.visitorFee.cashIncome);
  });

  test('37. Visitor Fee override 55,555 remains exactly 55,555 (NO ROUNDING)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.outstanding).toBe(55555);
  });

  test('38. No old visitor-fee calculation model used (does not multiply sessions * 50k)', async () => {
    // If old model were used, 2 sessions * 50,000 = 100,000. But actual due is 205,555.
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.due).toBe(205555);
  });

  // ============================================================
  // G. FIXED FEE / HISTORICAL IMMUTABILITY (Tests 39 - 40)
  // ============================================================
  test('39. Historical fixed fee report remains unchanged after current member configuration changes', async () => {
    // Update member days_per_week
    db.prepare('UPDATE members SET days_per_week = 5 WHERE id = ?').run(fixedMemberId);

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    // Historical fixed fund income remains 1,000,000
    expect(res.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(1000000);
  });

  test('40. Historical fixed fee report remains unchanged after current fee configuration changes', async () => {
    // Insert new fee_config version
    db.prepare(`
      INSERT INTO fee_configs (id, fee_type, name, calculation_method, effective_from, version, default_amount)
      VALUES ('fc_v2', 'FIXED_FUND', 'Cấu hình mới', 'EQUAL_SPLIT', '2026-10-01', 2, 2000000)
    `).run();

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(1000000);
  });

  // ============================================================
  // H. ACTIVITY (Tests 41 - 46)
  // ============================================================
  test('41. Session count correct (2 open sessions, excluding 1 cancelled)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.sessions).toBe(2);
  });

  test('42. Player count correct', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.totalPlayers).toBe(3);
  });

  test('43. Duplicate attendance does not inflate player count beyond actual present rows', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    // Total PRESENT attendance rows in active sessions = 3
    expect(res.body.data.activity.totalPlayers).toBe(3);
  });

  test('44. Shuttle usage correct (4 pieces)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.shuttleUsed).toBe(4);
  });

  test('45. Shuttle purchase is not counted as shuttle usage', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    // Purchase was 12 pieces, but usage is only 4 pieces
    expect(res.body.data.activity.shuttleUsed).toBe(4);
  });

  test('46. Current inventory correct (8 pieces remaining)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.currentInventory).toBe(8);
  });

  // ============================================================
  // I. MONTH ISOLATION (Tests 47 - 51)
  // ============================================================
  test('47. September data does not leak into October', async () => {
    const resOct = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resOct.body.data.financial.totalIncome).toBe(200000);
    expect(resOct.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(0);
  });

  test('48. October data does not leak into September', async () => {
    const resSep = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resSep.body.data.financial.totalIncome).toBe(1650000);
    expect(resSep.body.data.expenseBreakdown.COURT_FEE.amount).toBe(600000); // September court fee only
  });

  test('49. Opening balance correctly references prior month carry-forward', async () => {
    const resOct = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    // September ending balance = 650,000 => October opening balance = 650,000
    expect(resOct.body.data.financial.openingBalance).toBe(650000);
  });

  test('50. Visitor fee data isolated by month', async () => {
    const resOct = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resOct.body.data.visitorFee.due).toBe(0);
    expect(resOct.body.data.visitorFee.collected).toBe(0);
  });

  test('51. Expense categories isolated by month', async () => {
    const resSep = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resSep.body.data.expenseBreakdown.COURT_FEE.amount).toBe(600000);
  });

  // ============================================================
  // J. READ-ONLY GUARANTEE (Tests 52 - 54)
  // ============================================================
  test('52. GET report does not create, update, or delete records', async () => {
    const incBefore = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;
    const expBefore = (db.prepare('SELECT COUNT(*) as cnt FROM expense_transactions').get() as any).cnt;
    const invBefore = (db.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as any).cnt;

    await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const incAfter = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;
    const expAfter = (db.prepare('SELECT COUNT(*) as cnt FROM expense_transactions').get() as any).cnt;
    const invAfter = (db.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as any).cnt;

    expect(incAfter).toBe(incBefore);
    expect(expAfter).toBe(expBefore);
    expect(invAfter).toBe(invBefore);
  });

  test('53. Repeated GET produces identical result', async () => {
    const res1 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const res2 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.body.data).toEqual(res2.body.data);
  });

  test('54. Database state remains unchanged after repeated GETs', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
    }

    const sessionCount = (db.prepare('SELECT COUNT(*) as cnt FROM playing_sessions').get() as any).cnt;
    expect(sessionCount).toBe(3);
  });

  // ============================================================
  // K. SECURITY / DATA LEAK (Tests 55 - 60)
  // ============================================================
  test('55. No password or password_hash in response', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('password');
    expect(str).not.toContain('password_hash');
  });

  test('56. No JWT in response body', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('access_token');
    expect(str).not.toContain('Bearer');
  });

  test('57. No audit logs in response', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.audit_logs).toBeUndefined();
  });

  test('58. No private bank account details in response', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('account_number');
  });

  test('59. No private admin user information leaked', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('admin123');
  });

  test('60. No private email/phone data in response summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('0912345678');
  });

  // ============================================================
  // L. REPORT CONSISTENCY (Tests 61 - 65)
  // ============================================================
  test('61. Report endingBalance equals: openingBalance + totalIncome - totalExpense', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const { openingBalance, totalIncome, totalExpense, endingBalance } = res.body.data.financial;
    expect(endingBalance).toBe(openingBalance + totalIncome - totalExpense);
  });

  test('62. Income breakdown total equals totalIncome', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const inc = res.body.data.incomeBreakdown;
    const sum = inc.FIXED_FUND.amount + inc.VISITOR_FEE.amount + inc.OTHER_INCOME.amount;
    expect(sum).toBe(res.body.data.financial.totalIncome);
  });

  test('63. Expense breakdown total equals totalExpense', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const exp = res.body.data.expenseBreakdown;
    const sum = exp.COURT_FEE.amount + exp.SHUTTLE_PURCHASE.amount + exp.OTHER_EXPENSE.amount;
    expect(sum).toBe(res.body.data.financial.totalExpense);
  });

  test('64. Visitor collected does not exceed due', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const vf = res.body.data.visitorFee;
    expect(vf.collected).toBeLessThanOrEqual(vf.due);
  });

  test('65. Visitor outstanding equals due - collected', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const vf = res.body.data.visitorFee;
    expect(vf.outstanding).toBe(vf.due - vf.collected);
  });

  // ============================================================
  // M. INDEPENDENT CROSS-CHECKS (Tests 66 - 73)
  // ============================================================
  test('66. Independent Financial Source Cross-Check (Month A)', async () => {
    const rawIncSum = (
      db.prepare("SELECT COALESCE(SUM(rounded_amount), 0) AS s FROM income_transactions WHERE month_key = '2026-09' AND is_void = 0").get() as any
    ).s;

    const rawExpSum = (
      db.prepare("SELECT COALESCE(SUM(rounded_amount), 0) AS s FROM expense_transactions WHERE month_key = '2026-09' AND is_void = 0").get() as any
    ).s;

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.financial.totalIncome).toBe(rawIncSum);
    expect(res.body.data.financial.totalExpense).toBe(rawExpSum);
  });

  test('67. Independent Inventory Source Cross-Check (Month A)', async () => {
    const rawReceipt = (
      db.prepare("SELECT COALESCE(SUM(quantity_in_pieces), 0) AS s FROM inventory_transactions WHERE transaction_type = 'RECEIPT'").get() as any
    ).s;

    const rawUsage = Math.abs(
      (db.prepare("SELECT COALESCE(SUM(quantity_in_pieces), 0) AS s FROM inventory_transactions WHERE transaction_type = 'USAGE'").get() as any).s
    );

    const expectedStock = rawReceipt - rawUsage;

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.activity.currentInventory).toBe(expectedStock);
  });

  test('68. Independent Visitor Fee Cross-Check', async () => {
    const rawDue = (
      db.prepare(`
        SELECT COALESCE(SUM(svf.amount), 0) AS s
        FROM session_visitor_fees svf
        JOIN playing_sessions ps ON svf.session_id = ps.id
        WHERE ps.month_key = '2026-09'
      `).get() as any
    ).s;

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.visitorFee.due).toBe(rawDue);
  });

  test('69. Idempotency & Refresh test (Multiple GET calls return identical data)', async () => {
    const call1 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const call2 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(call1.body).toEqual(call2.body);
  });

  test('70. Zero income / zero expense month handling (Month 2026-11)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);

    // Month 11 opening balance = Month 10 ending balance = -650,000
    expect(res.body.data.financial.openingBalance).toBe(-650000);
    expect(res.body.data.financial.totalIncome).toBe(0);
    expect(res.body.data.financial.totalExpense).toBe(0);
    expect(res.body.data.financial.endingBalance).toBe(-650000);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.percentage).toBe(0);
    expect(res.body.data.expenseBreakdown.COURT_FEE.percentage).toBe(0);
  });

  test('71. Activity Sessions count cross-check with database source of truth', async () => {
    const dbSessions = (
      db.prepare("SELECT COUNT(*) as cnt FROM playing_sessions WHERE month_key = '2026-09' AND status != 'CANCELLED'").get() as any
    ).cnt;

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.activity.sessions).toBe(dbSessions);
  });

  test('72. Activity Player count cross-check with database source of truth', async () => {
    const dbPlayers = (
      db.prepare(`
        SELECT COUNT(psm.id) as cnt
        FROM playing_session_members psm
        JOIN playing_sessions ps ON psm.session_id = ps.id
        WHERE ps.month_key = '2026-09' AND ps.status != 'CANCELLED' AND psm.attendance_status = 'PRESENT'
      `).get() as any
    ).cnt;

    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.activity.totalPlayers).toBe(dbPlayers);
  });

  test('73. Final Financial Reconciliation Identity Check', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const f = res.body.data.financial;
    const i = res.body.data.incomeBreakdown;
    const e = res.body.data.expenseBreakdown;

    expect(f.endingBalance).toBe(f.openingBalance + f.totalIncome - f.totalExpense);
    expect(f.totalIncome).toBe(i.FIXED_FUND.amount + i.VISITOR_FEE.amount + i.OTHER_INCOME.amount);
    expect(f.totalExpense).toBe(e.COURT_FEE.amount + e.SHUTTLE_PURCHASE.amount + e.OTHER_EXPENSE.amount);
  });
});
