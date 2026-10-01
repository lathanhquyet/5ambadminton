import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { resetTestDatabase } from '../database/resetTestDb';
import { getCashLedgerSummary } from '../services/cashLedgerService';
import { getStockSummary } from '../services/inventoryService';

describe('PHASE 4.5: TEST DATA RESET & CREATE SESSION MEMBER UX TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let member1Id: string;
  let member2Id: string;
  let member3Id: string;
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

    // Create 3 FIXED members for session creation testing
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date)
      VALUES ('m_test_1', 'Thành Viên A', '0901111111', 'FIXED', 'ACTIVE', '2026-09-01')
    `).run();
    member1Id = 'm_test_1';

    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date)
      VALUES ('m_test_2', 'Thành Viên B', '0902222222', 'FIXED', 'ACTIVE', '2026-09-01')
    `).run();
    member2Id = 'm_test_2';

    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date)
      VALUES ('m_test_3', 'Thành Viên C', '0903333333', 'FIXED', 'ACTIVE', '2026-09-01')
    `).run();
    member3Id = 'm_test_3';
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('1. Clean database reset mechanism', () => {
    // Insert dummy test data into business tables
    db.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status)
      VALUES ('sess_reset_test', '2026-09-01', '2026-09', 'OPEN')
    `).run();
    db.prepare(`
      INSERT INTO playing_session_members (id, session_id, member_id, attendance_status)
      VALUES ('psm_reset_test', 'sess_reset_test', 'm_test_1', 'PRESENT')
    `).run();

    // Perform database reset
    resetTestDatabase(db);

    // Verify all business tables clean
    const sessionsCount = (db.prepare('SELECT COUNT(*) as cnt FROM playing_sessions').get() as any).cnt;
    const psmCount = (db.prepare('SELECT COUNT(*) as cnt FROM playing_session_members').get() as any).cnt;
    const incomeCount = (db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get() as any).cnt;
    const expenseCount = (db.prepare('SELECT COUNT(*) as cnt FROM expense_transactions').get() as any).cnt;
    const invTxCount = (db.prepare('SELECT COUNT(*) as cnt FROM inventory_transactions').get() as any).cnt;

    expect(sessionsCount).toBe(0);
    expect(psmCount).toBe(0);
    expect(incomeCount).toBe(0);
    expect(expenseCount).toBe(0);
    expect(invTxCount).toBe(0);

    // Verify foreign keys active
    const fkState = db.pragma('foreign_keys', { simple: true });
    expect(fkState).toBe(1);

    // Re-insert test members after reset
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, joined_date)
      VALUES ('m_test_1', 'Thành Viên A', '0901111111', 'FIXED', 'ACTIVE', '2026-09-01'),
             ('m_test_2', 'Thành Viên B', '0902222222', 'FIXED', 'ACTIVE', '2026-09-01'),
             ('m_test_3', 'Thành Viên C', '0903333333', 'FIXED', 'ACTIVE', '2026-09-01')
    `).run();
  });

  test('2. Create session without members', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-02',
        notes: 'Session without members'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_players).toBe(0);
    expect(res.body.data.attendance).toHaveLength(0);
  });

  test('3. Create session with 1 member', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-03',
        member_ids: [member1Id]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_players).toBe(1);
    expect(res.body.data.attendance).toHaveLength(1);
    expect(res.body.data.attendance[0].member_id).toBe(member1Id);
  });

  test('4. Create session with multiple members', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-04',
        member_ids: [member1Id, member2Id, member3Id]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_players).toBe(3);
    expect(res.body.data.attendance).toHaveLength(3);
  });

  test('5. Duplicate member prevention during session creation', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-05',
        member_ids: [member1Id, member1Id, member2Id] // Duplicate member1Id
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total_players).toBe(2); // Only 2 unique members
    expect(res.body.data.attendance).toHaveLength(2);
  });

  test('6. Add member after session creation', async () => {
    const sRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-09-06' });

    const sessionId = sRes.body.data.id;

    const attRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: member1Id,
        attendance_status: 'PRESENT',
        current_date: '2026-09-06'
      });

    expect(attRes.status).toBe(200);
    expect(attRes.body.data.total_players).toBe(1);
  });

  test('7. Remove member (mark ABSENT) according to current rules', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-06') as any;

    const attRes = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        member_id: member1Id,
        attendance_status: 'ABSENT',
        current_date: '2026-09-06'
      });

    expect(attRes.status).toBe(200);
    expect(attRes.body.data.total_players).toBe(0);
  });

  test('8. Visitor creation', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const res = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Test Phase 4.5',
        phone: '0988776655'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.visitorFeeId).toBeDefined();
  });

  test('9. Visitor fee default 50,000 VND', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const res = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Default Fee'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(50000);
  });

  test('10. Visitor fee exact override without rounding (55,555 stays 55,555)', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const res = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Override Fee',
        amount: 55555
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(55555); // EXACT AMOUNT
  });

  test('11. Unpaid visitor fee stays Outstanding only', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const res = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Chưa Thu',
        amount: 50000,
        is_paid: false
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('UNPAID');
    expect(res.body.data.incomeTransactionId).toBeNull();
  });

  test('12. Paid visitor fee creates VISITOR_FEE income', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const res = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Đã Thu',
        amount: 60000,
        is_paid: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.incomeTransactionId).toBeDefined();

    const incTx = db.prepare('SELECT * FROM income_transactions WHERE id = ?').get(res.body.data.incomeTransactionId) as any;
    expect(incTx.category).toBe('VISITOR_FEE');
    expect(incTx.rounded_amount).toBe(60000);
  });

  test('13. No duplicate visitor fee on retrying visitor fee payment', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-02') as any;

    const addRes = await request(app)
      .post(`/api/v1/sessions/${sRes.id}/visitors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Khách Thu Lại',
        amount: 50000,
        is_paid: false
      });

    const feeId = addRes.body.data.visitorFeeId;

    const pay1 = await request(app)
      .post(`/api/v1/sessions/visitor-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);

    const pay2 = await request(app)
      .post(`/api/v1/sessions/visitor-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pay1.body.data.incomeTransactionId).toBe(pay2.body.data.incomeTransactionId);
  });

  test('14. No duplicate income records for same visitor fee', async () => {
    const visitorIncomeCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM income_transactions WHERE category = 'VISITOR_FEE'").get() as any
    ).cnt;

    const distinctFeeCount = (
      db.prepare("SELECT COUNT(DISTINCT income_transaction_id) as cnt FROM session_visitor_fees WHERE status = 'PAID' AND income_transaction_id IS NOT NULL").get() as any
    ).cnt;

    expect(visitorIncomeCount).toBe(distinctFeeCount);
  });

  test('15. No duplicate attendance records', async () => {
    const sRes = db.prepare('SELECT id FROM playing_sessions WHERE session_date = ?').get('2026-09-04') as any;

    // Try adding member1Id multiple times via attendance endpoint
    await request(app)
      .post(`/api/v1/sessions/${sRes.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: member1Id, attendance_status: 'PRESENT' });

    await request(app)
      .post(`/api/v1/sessions/${sRes.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: member1Id, attendance_status: 'PRESENT' });

    const psmRecords = db
      .prepare('SELECT * FROM playing_session_members WHERE session_id = ? AND member_id = ?')
      .all(sRes.id, member1Id);

    expect(psmRecords.length).toBe(1);
  });

  test('16. Adding members does NOT modify inventory or create fixed member fee', async () => {
    const stockBefore = getStockSummary(db, 'prod_tc77');

    await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-07',
        member_ids: [member1Id, member2Id]
      });

    const stockAfter = getStockSummary(db, 'prod_tc77');
    expect(stockAfter.total_pieces).toBe(stockBefore.total_pieces);

    // FIXED_FUND fee count should not change
    const fixedFees = db.prepare("SELECT * FROM member_fees WHERE fee_type = 'FIXED_FUND'").all();
    expect(fixedFees.length).toBe(0);
  });

  test('17. Cancelled session protection (reject attendance updates)', async () => {
    const sRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-09-08' });

    const sessionId = sRes.body.data.id;

    // Cancel session
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try to update attendance on cancelled session
    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: member1Id, attendance_status: 'PRESENT' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SESSION_CANCELLED');
  });

  test('18. Closed month protection (HTTP 403 MONTH_CLOSED)', async () => {
    const closedMonth = '2026-08';
    db.prepare(`
      INSERT OR REPLACE INTO monthly_closings (id, month_key, status)
      VALUES ('closed_08_test', ?, 'CLOSED')
    `).run(closedMonth);

    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-08-15' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MONTH_CLOSED');
  });

  test('19. Atomic session + attendance creation (rollback on failure)', async () => {
    // Attempt to create session with session_date duplicate to test atomic behavior
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-04', // Existing session_date
        member_ids: [member1Id]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_SESSION_DATE');

    // Verify no stray playing_session or session_members created
    const strayCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM playing_sessions WHERE session_date = '2026-09-04'").get() as any
    ).cnt;
    expect(strayCount).toBe(1); // Only the existing session from test 4
  });

  test('20. Retry / Idempotency on session creation', async () => {
    const res1 = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-09',
        member_ids: [member1Id, member2Id]
      });

    expect(res1.status).toBe(201);

    // Retrying with same session_date should be cleanly rejected without corrupting data
    const res2 = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-09-09',
        member_ids: [member1Id, member2Id]
      });

    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('DUPLICATE_SESSION_DATE');
  });
});
