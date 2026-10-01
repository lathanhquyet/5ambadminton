import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { getCurrentStockInPieces } from '../services/inventoryService';

describe('PHASE 2 MANDATORY TEST SUITE (SESSIONS, ATTENDANCE & SHUTTLE INVENTORY)', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    // In-memory SQLite DB for test isolation
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    // Initial stock setup: import 20 tubes (240 pieces) for testing
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, transaction_date, month_key, product_id, transaction_type,
        quantity_in_pieces, reference_type, notes
      ) VALUES ('inv_init_01', '2026-10-01', '2026-10', 'prod_tc77', 'RECEIPT', 240, 'MANUAL', 'Nhập kho ban đầu 20 ống (240 trái)')
    `).run();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('TEST 1: 10 members created, check 7 PRESENT -> total_players = 7', async () => {
    // 1. Create 10 members
    const memberIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: `Member Test ${i}`,
          member_type: i <= 7 ? 'FIXED' : 'VISITOR',
          days_per_week: i <= 7 ? 5 : 0,
          joined_date: '2026-10-01'
        });
      expect(res.status).toBe(201);
      memberIds.push(res.body.data.id);
    }

    // 2. Create a playing session for 2026-10-10
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-10-10',
        notes: 'Buổi chơi Test 1'
      });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.data.id;

    // 3. Attendance check 7 members as PRESENT, 3 as ABSENT
    for (let i = 0; i < 10; i++) {
      const status = i < 7 ? 'PRESENT' : 'ABSENT';
      const attRes = await request(app)
        .post(`/api/v1/sessions/${sessionId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          member_id: memberIds[i],
          attendance_status: status
        });
      expect(attRes.status).toBe(200);
    }

    // 4. Verify total_players on session is exactly 7
    const getSessionRes = await request(app)
      .get(`/api/v1/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getSessionRes.status).toBe(200);
    expect(getSessionRes.body.data.total_players).toBe(7);
  });

  test('TEST 2: shuttle_used 3 -> 4 => inventory decreases by 1 (Delta = -1)', async () => {
    const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

    // Create session
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-11' });
    const sessionId = sessionRes.body.data.id;

    // Set shuttle_used = 3
    await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 3 });

    const stockAfter3 = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter3).toBe(stockBefore - 3);

    // Update shuttle_used = 4 (Delta = +1 additional used)
    const updateRes = await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 4 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.usage_details.delta).toBe(1);

    const stockAfter4 = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter4).toBe(stockAfter3 - 1); // Inventory decreases by exactly 1
  });

  test('TEST 3: shuttle_used 4 -> 3 => inventory refunds 1 (Delta = -1)', async () => {
    // Create session
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-12' });
    const sessionId = sessionRes.body.data.id;

    // Set shuttle_used = 4
    await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 4 });

    const stockAfter4 = getCurrentStockInPieces(db, 'prod_tc77');

    // Update shuttle_used = 3
    const updateRes = await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 3 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.usage_details.delta).toBe(-1);

    const stockAfter3 = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter3).toBe(stockAfter4 + 1); // Inventory refunds exactly 1
  });

  test('TEST 4: Session used 5 shuttles, CANCEL session => inventory refunds 5 shuttles', async () => {
    // Create session
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-13' });
    const sessionId = sessionRes.body.data.id;

    // Use 5 shuttles
    await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 5 });

    const stockWithUsage = getCurrentStockInPieces(db, 'prod_tc77');

    // Cancel session
    const cancelRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.refund_details.refundedPieces).toBe(5);

    const stockAfterCancel = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfterCancel).toBe(stockWithUsage + 5); // Refunds exact 5 shuttles
  });

  test('TEST 5: NO expense_transaction generated when using shuttles', async () => {
    const expenseCountBefore = (
      db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any
    ).cnt;

    // Create session & record shuttle usage
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-14' });
    const sessionId = sessionRes.body.data.id;

    await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 6 });

    const expenseCountAfter = (
      db.prepare('SELECT COUNT(*) AS cnt FROM expense_transactions').get() as any
    ).cnt;

    expect(expenseCountAfter).toBe(expenseCountBefore); // Zero expense transactions generated
  });

  test('TEST 6: NO duplicate attendance for same (session_id, member_id)', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-15' });
    const sessionId = sessionRes.body.data.id;

    const memberRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Member Dup Check', member_type: 'FIXED', days_per_week: 3, joined_date: '2026-10-01' });
    const memberId = memberRes.body.data.id;

    // Call attendance 3 times for same member & session
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: memberId, attendance_status: 'PRESENT' });

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: memberId, attendance_status: 'PRESENT' });

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ member_id: memberId, attendance_status: 'ABSENT' });

    const attendanceRecords = db
      .prepare('SELECT * FROM playing_session_members WHERE session_id = ? AND member_id = ?')
      .all(sessionId, memberId);

    expect(attendanceRecords.length).toBe(1); // Exactly 1 row due to UPSERT / UNIQUE constraint
  });

  test('TEST 7: CANCELLED session cannot accept shuttle usage updates', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ session_date: '2026-10-16' });
    const sessionId = sessionRes.body.data.id;

    // Cancel session
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try updating shuttle usage on cancelled session
    const res = await request(app)
      .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shuttle_used: 4 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SHUTTLE_USAGE_ERROR');
    expect(res.body.error.message).toContain('CANCELLED');
  });
});
