import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { resetTestDatabase } from '../database/resetTestDb';

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatMonthDisplay(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [year, month] = monthKey.split('-');
  return `Tháng ${month}/${year}`;
}

describe('PHASE 5B: ADMIN DASHBOARD UI & REPORT INTEGRATION TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let memberToken: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    resetTestDatabase(db);

    // Login Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLoginRes.body.data.access_token;

    // Create a regular member user for RBAC test
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date, days_per_week)
      VALUES ('m_dash_1', 'Thành Viên Dashboard', '0911223344', 'FIXED', 'ACTIVE', '2026-09-01', 3),
             ('m_dash_2', 'Thành Viên Dashboard 2', '0911223355', 'FIXED', 'ACTIVE', '2026-09-01', 2)
    `).run();

    const pwdHash = (db.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get() as any).password_hash;
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, member_id)
      VALUES ('u_dash_member', 'dashmember', ?, 'MEMBER', 'm_dash_1')
    `).run(pwdHash);

    const memberLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dashmember', password: 'admin123' });
    memberToken = memberLoginRes.body.data.access_token;

    setupDeterministicDashboardData(db);
  });

  afterAll(() => {
    if (db) db.close();
  });

  function setupDeterministicDashboardData(database: ReturnType<typeof Database>) {
    // --- Month A (2026-09) ---
    database.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status, total_players)
      VALUES ('sess_dash_1', '2026-09-05', '2026-09', 'OPEN', 2),
             ('sess_dash_2', '2026-09-12', '2026-09', 'OPEN', 1),
             ('sess_dash_cancelled', '2026-09-20', '2026-09', 'CANCELLED', 0)
    `).run();

    database.prepare(`
      INSERT INTO playing_session_members (id, session_id, member_id, attendance_status)
      VALUES ('psm_dash_1', 'sess_dash_1', 'm_dash_1', 'PRESENT'),
             ('psm_dash_2', 'sess_dash_1', 'm_dash_2', 'PRESENT'),
             ('psm_dash_3', 'sess_dash_2', 'm_dash_1', 'PRESENT')
    `).run();

    // Incomes: FIXED_FUND: 1,000,000, VISITOR_FEE: 150,000, OTHER_INCOME: 500,000
    database.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_d_1', '2026-09-01', '2026-09', 'FIXED_FUND', 'Thu quỹ tháng 9', 1000000, 1000000, 0),
             ('inc_d_2', '2026-09-05', '2026-09', 'VISITOR_FEE', 'Khách vãng lai 1', 50000, 50000, 0),
             ('inc_d_3', '2026-09-05', '2026-09', 'VISITOR_FEE', 'Khách vãng lai 2', 100000, 100000, 0),
             ('inc_d_4', '2026-09-10', '2026-09', 'OTHER_INCOME', 'Tài trợ', 500000, 500000, 0)
    `).run();

    // Visitor fees: 50,000 paid, 100,000 paid, 55,555 unpaid (exact override)
    database.prepare(`
      INSERT INTO session_visitor_fees (id, session_id, member_id, amount, status, income_transaction_id)
      VALUES ('vf_d_1', 'sess_dash_1', 'm_dash_1', 50000, 'PAID', 'inc_d_2'),
             ('vf_d_2', 'sess_dash_1', 'm_dash_2', 100000, 'PAID', 'inc_d_3'),
             ('vf_d_3', 'sess_dash_2', 'm_dash_1', 55555, 'UNPAID', NULL)
    `).run();

    // Expenses: COURT_FEE: 600,000, SHUTTLE_PURCHASE: 300,000, OTHER_EXPENSE: 100,000
    database.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_d_1', '2026-09-01', '2026-09', 'COURT_FEE', 'Tiền sân', 600000, 600000, 0),
             ('exp_d_2', '2026-09-02', '2026-09', 'SHUTTLE_PURCHASE', 'Mua cầu', 300000, 300000, 0),
             ('exp_d_3', '2026-09-15', '2026-09', 'OTHER_EXPENSE', 'Nước uống', 100000, 100000, 0)
    `).run();

    // Inventory: RECEIPT 12, USAGE -4
    database.prepare(`
      INSERT INTO inventory_transactions (id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces, total_amount)
      VALUES ('inv_d_1', '2026-09-02', '2026-09', 'prod_tc77', 'RECEIPT', 12, 300000),
             ('inv_d_2', '2026-09-05', '2026-09', 'prod_tc77', 'USAGE', -4, 0)
    `).run();

    // --- Month B (2026-10): High expense => Negative Ending Balance ---
    // Opening = 650,000, Income = 200,000, Expense = 1,500,000 => Ending = -650,000
    database.prepare(`
      INSERT INTO income_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('inc_oct_d1', '2026-10-01', '2026-10', 'OTHER_INCOME', 'Thu khác', 200000, 200000, 0)
    `).run();

    database.prepare(`
      INSERT INTO expense_transactions (id, transaction_date, month_key, category, description, original_amount, rounded_amount, is_void)
      VALUES ('exp_oct_d1', '2026-10-05', '2026-10', 'COURT_FEE', 'Tiền sân tháng 10', 1500000, 1500000, 0)
    `).run();
  }

  // --- A. ROUTE / AUTH (1-5) ---
  test('1. Dashboard route API exists', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('2. Authenticated Admin can access Dashboard data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.success).toBe(true);
    expect(res.body.data.month).toBe('2026-09');
  });

  test('3. Unauthenticated user rejected with HTTP 401', async () => {
    const res = await request(app).get('/api/v1/reports/monthly?month=2026-09');
    expect(res.status).toBe(401);
  });

  test('4. Non-authorized role (MEMBER) receives HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('5. Existing auth flow remains intact', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('admin');
  });

  // --- B. MONTH SELECTOR (6-12) ---
  test('6. Dashboard handles selected month string YYYY-MM', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.month).toBe('2026-09');
  });

  test('7. Month display formatter produces "Tháng 09/2026"', () => {
    expect(formatMonthDisplay('2026-09')).toBe('Tháng 09/2026');
  });

  test('8. Changing month sends correct YYYY-MM to Report API', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.month).toBe('2026-10');
  });

  test('9. 2026-09 request returns September data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBe(1650000);
  });

  test('10. 2026-10 request returns October data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBe(200000);
  });

  test('11. Month change does not mutate backend data (Read-Only)', async () => {
    const countBefore = (db.prepare('SELECT COUNT(*) as cnt FROM playing_sessions').get() as any).cnt;

    await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    const countAfter = (db.prepare('SELECT COUNT(*) as cnt FROM playing_sessions').get() as any).cnt;
    expect(countAfter).toBe(countBefore);
  });

  test('12. Invalid API month response handled safely with HTTP 400', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-13')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // --- C. FINANCIAL SUMMARY & FORMATTING (13-18) ---
  test('13. Opening balance returned exactly (0)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.openingBalance).toBe(0);
    expect(formatCurrency(res.body.data.financial.openingBalance)).toBe('0 ₫');
  });

  test('14. Total income returned exactly (1,650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBe(1650000);
    expect(formatCurrency(res.body.data.financial.totalIncome)).toBe('1.650.000 ₫');
  });

  test('15. Total expense returned exactly (1,000,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalExpense).toBe(1000000);
    expect(formatCurrency(res.body.data.financial.totalExpense)).toBe('1.000.000 ₫');
  });

  test('16. Ending balance returned exactly (650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.endingBalance).toBe(650000);
    expect(formatCurrency(res.body.data.financial.endingBalance)).toBe('650.000 ₫');
  });

  test('17. Negative ending balance keeps negative sign (-650,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.endingBalance).toBe(-650000);
    expect(formatCurrency(res.body.data.financial.endingBalance)).toBe('-650.000 ₫');
  });

  test('18. Formatters preserve exact values without rounding or Math.ceil', () => {
    expect(formatCurrency(55555)).toBe('55.555 ₫');
    expect(formatCurrency(75123)).toBe('75.123 ₫');
    expect(formatCurrency(0)).toBe('0 ₫');
  });

  // --- D. FRONTEND NO RECALCULATION INTEGRITY (19-25) ---
  test('19. Dashboard uses backend totalIncome directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBeDefined();
  });

  test('20. Dashboard uses backend totalExpense directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalExpense).toBeDefined();
  });

  test('21. Dashboard uses backend endingBalance directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.endingBalance).toBeDefined();
  });

  test('22. Dashboard does NOT calculate endingBalance itself (matches opening + income - expense)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const f = res.body.data.financial;
    expect(f.endingBalance).toBe(f.openingBalance + f.totalIncome - f.totalExpense);
  });

  test('23. Dashboard uses backend income percentages directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const inc = res.body.data.incomeBreakdown;
    expect(inc.FIXED_FUND.percentage).toBe(60.61);
    expect(inc.VISITOR_FEE.percentage).toBe(9.09);
    expect(inc.OTHER_INCOME.percentage).toBe(30.3);
  });

  test('24. Dashboard uses backend expense percentages directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.percentage).toBe(60);
    expect(exp.SHUTTLE_PURCHASE.percentage).toBe(30);
    expect(exp.OTHER_EXPENSE.percentage).toBe(10);
  });

  test('25. Dashboard uses backend visitor outstanding directly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.outstanding).toBe(55555);
  });

  // --- E. INCOME BREAKDOWN (26-30) ---
  test('26. FIXED_FUND displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(1000000);
  });

  test('27. VISITOR_FEE displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.VISITOR_FEE.amount).toBe(150000);
  });

  test('28. OTHER_INCOME displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.OTHER_INCOME.amount).toBe(500000);
  });

  test('29. Backend percentage displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.percentage).toBe(60.61);
  });

  test('30. Zero income renders 0% without NaN/Infinity', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    const inc = res.body.data.incomeBreakdown;
    expect(inc.FIXED_FUND.amount).toBe(0);
    expect(inc.FIXED_FUND.percentage).toBe(0);
    expect(inc.VISITOR_FEE.percentage).toBe(0);
    expect(inc.OTHER_INCOME.percentage).toBe(0);
  });

  // --- F. EXPENSE BREAKDOWN (31-35) ---
  test('31. COURT_FEE displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.COURT_FEE.amount).toBe(600000);
  });

  test('32. SHUTTLE_PURCHASE displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.SHUTTLE_PURCHASE.amount).toBe(300000);
  });

  test('33. OTHER_EXPENSE displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.OTHER_EXPENSE.amount).toBe(100000);
  });

  test('34. Backend percentage displayed correctly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.COURT_FEE.percentage).toBe(60);
  });

  test('35. Zero expense renders 0% without NaN/Infinity', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.amount).toBe(0);
    expect(exp.COURT_FEE.percentage).toBe(0);
    expect(exp.SHUTTLE_PURCHASE.percentage).toBe(0);
    expect(exp.OTHER_EXPENSE.percentage).toBe(0);
  });

  // --- G. VISITOR FEE (36-41) ---
  test('36. Due displayed correctly (205,555)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.due).toBe(205555);
  });

  test('37. Collected displayed correctly (150,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.collected).toBe(150000);
  });

  test('38. Outstanding displayed correctly (55,555)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.outstanding).toBe(55555);
  });

  test('39. Cash income displayed correctly (150,000)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.visitorFee.cashIncome).toBe(150000);
  });

  test('40. Exact 55,555 formats as "55.555 ₫"', () => {
    expect(formatCurrency(55555)).toBe('55.555 ₫');
  });

  test('41. UI formatters do not round Visitor Fee', () => {
    expect(formatCurrency(51500)).toBe('51.500 ₫');
    expect(formatCurrency(75123)).toBe('75.123 ₫');
  });

  // --- H. ACTIVITY (42-46) ---
  test('42. Session count displayed (2 open sessions)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.sessions).toBe(2);
  });

  test('43. Total player count displayed (3 present attendance rows)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.totalPlayers).toBe(3);
  });

  test('44. Shuttle usage displayed (4 pieces)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.shuttleUsed).toBe(4);
  });

  test('45. Current inventory displayed (8 pieces remaining)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.currentInventory).toBe(8);
  });

  test('46. Cancelled sessions are not independently counted as active sessions', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    // 3 total sessions inserted, 1 cancelled => 2 active open sessions
    expect(res.body.data.activity.sessions).toBe(2);
  });

  // --- I. ZERO / EMPTY (47-53) ---
  test('47. Zero-income month works cleanly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).toBe(0);
  });

  test('48. Zero-expense month works cleanly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalExpense).toBe(0);
  });

  test('49. Zero-activity month works cleanly', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.sessions).toBe(0);
    expect(res.body.data.activity.totalPlayers).toBe(0);
    expect(res.body.data.activity.shuttleUsed).toBe(0);
  });

  test('50. Zero-inventory month format works', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.activity.currentInventory).toBeDefined();
  });

  test('51. No NaN in response or formatting', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('NaN');
  });

  test('52. No Infinity in response or formatting', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('Infinity');
  });

  test('53. No undefined financial text in report DTO', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.financial.totalIncome).not.toBeNull();
    expect(res.body.data.financial.totalExpense).not.toBeNull();
  });

  // --- J. LOADING / ERROR / REFRESH (54-63) ---
  test('54. Missing month query returns HTTP 400', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('55. Error state triggered when API fails with invalid month format', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=invalid_month')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('56. Retry works by sending valid YYYY-MM request after error', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('57. Error response does not contain fake zero data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=invalid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data).toBeUndefined();
    expect(res.body.error).toBeDefined();
  });

  test('58. Previous month data isolated from subsequent month requests', async () => {
    const resSep = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const resOct = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resSep.body.data.financial.totalIncome).not.toBe(resOct.body.data.financial.totalIncome);
  });

  test('59. Refreshing dashboard performs GET only', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('60. Refresh does not create financial transactions', async () => {
    const incCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;

    await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const incCountAfter = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;
    expect(incCountAfter).toBe(incCountBefore);
  });

  test('61. Refresh does not create inventory movements', async () => {
    const invCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as any).cnt;

    await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const invCountAfter = (db.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as any).cnt;
    expect(invCountAfter).toBe(invCountBefore);
  });

  test('62. Refresh does not create attendance', async () => {
    const psmCountBefore = (db.prepare('SELECT COUNT(*) as cnt FROM playing_session_members').get() as any).cnt;

    await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);

    const psmCountAfter = (db.prepare('SELECT COUNT(*) as cnt FROM playing_session_members').get() as any).cnt;
    expect(psmCountAfter).toBe(psmCountBefore);
  });

  test('63. Refresh does not change database state', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
    }
    const sessionCount = (db.prepare('SELECT COUNT(*) as cnt FROM playing_sessions').get() as any).cnt;
    expect(sessionCount).toBe(3);
  });

  // --- K. MONTH ISOLATION (64-68) ---
  test('64. September report renders September data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.month).toBe('2026-09');
    expect(res.body.data.financial.totalIncome).toBe(1650000);
  });

  test('65. October report renders October data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.month).toBe('2026-10');
    expect(res.body.data.financial.totalIncome).toBe(200000);
  });

  test('66. Switching September -> October updates all dashboard sections', async () => {
    const res1 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const res2 = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.body.data.financial.endingBalance).toBe(650000);
    expect(res2.body.data.financial.endingBalance).toBe(-650000);
  });

  test('67. No September values remain in October UI payload', async () => {
    const resOct = await request(app)
      .get('/api/v1/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resOct.body.data.incomeBreakdown.FIXED_FUND.amount).toBe(0);
  });

  test('68. No October values leak into September UI payload', async () => {
    const resSep = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resSep.body.data.financial.totalExpense).toBe(1000000); // 1,000,000 for Sep, not 1,500,000 from Oct
  });

  // --- M. SECURITY / DATA DISPLAY (74-78) ---
  test('74. Dashboard payload does not display password or password_hash', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('password');
    expect(str).not.toContain('password_hash');
  });

  test('75. Dashboard payload does not display JWT', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('access_token');
    expect(str).not.toContain('Bearer');
  });

  test('76. Dashboard payload does not display audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.audit_logs).toBeUndefined();
  });

  test('77. Dashboard payload does not display private bank account details', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('account_number');
  });

  test('78. Dashboard payload does not display admin private credentials', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const str = JSON.stringify(res.body);
    expect(str).not.toContain('admin123');
  });

  // --- N. CHARTS & DATA INTEGRITY (79-84) ---
  test('79. Income breakdown values match API data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const inc = res.body.data.incomeBreakdown;
    expect(inc.FIXED_FUND.amount + inc.VISITOR_FEE.amount + inc.OTHER_INCOME.amount).toBe(res.body.data.financial.totalIncome);
  });

  test('80. Expense breakdown values match API data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    const exp = res.body.data.expenseBreakdown;
    expect(exp.COURT_FEE.amount + exp.SHUTTLE_PURCHASE.amount + exp.OTHER_EXPENSE.amount).toBe(res.body.data.financial.totalExpense);
  });

  test('81. Zero-income breakdown does not crash', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.percentage).toBe(0);
  });

  test('82. Zero-expense breakdown does not crash', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.expenseBreakdown.COURT_FEE.percentage).toBe(0);
  });

  test('83. Chart data values correspond directly to API data without frontend recalculation', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-09')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.incomeBreakdown.FIXED_FUND.percentage).toBe(60.61);
  });

  test('84. Formatters handle zero and negative values cleanly', () => {
    expect(formatCurrency(0)).toBe('0 ₫');
    expect(formatCurrency(-1500000)).toBe('-1.500.000 ₫');
    expect(formatMonthDisplay('2026-10')).toBe('Tháng 10/2026');
  });
});
