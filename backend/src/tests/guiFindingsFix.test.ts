import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { calculateExpectedDays, roundupToTenThousand } from '../services/businessFormula';

describe('PRE-PHASE 5C — GUI FINDINGS FIX & MEMBER STATUS TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;
  let testMemberId: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    await runSeed(db);
    app = createApp(db);

    // Login as Admin
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe('REQUIREMENT #1 & #2 — FINANCIAL ENGINE INTEGRITY & 10K ROUNDING', () => {
    test('FeeEngine 10k rounding formula remains strictly intact (UNCHANGED)', () => {
      expect(roundupToTenThousand(753855)).toBe(760000);
      expect(roundupToTenThousand(458868)).toBe(460000);
      expect(roundupToTenThousand(500000)).toBe(500000);
      expect(roundupToTenThousand(500001)).toBe(510000);
    });

    test('Expected days calculation formula remains strictly intact', () => {
      // Oct 2026 (31 days), 5 days/week = Math.ceil(5 * 31 / 7) = 23 days
      expect(calculateExpectedDays(5, 2026, 10)).toBe(23);
    });
  });

  describe('REQUIREMENT #3 — MEMBER ACTIVE / INACTIVE TEST MATRIX', () => {
    test('TEST 1: Create a new Member (default status ACTIVE)', async () => {
      const res = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Member Status Test User',
          phone: '0987654321',
          email: 'statustest@example.com',
          member_type: 'FIXED',
          days_per_week: 5,
          joined_date: '2026-10-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      testMemberId = res.body.data.id;
    });

    test('TEST 2: Active -> Inactive status update', async () => {
      const res = await request(app)
        .put(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INACTIVE');

      // Verify DB record status
      const dbMember = db.prepare('SELECT status FROM members WHERE id = ?').get(testMemberId) as any;
      expect(dbMember.status).toBe('INACTIVE');
    });

    test('TEST 3: Inactive -> Active status update', async () => {
      const res = await request(app)
        .put(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');

      const dbMember = db.prepare('SELECT status FROM members WHERE id = ?').get(testMemberId) as any;
      expect(dbMember.status).toBe('ACTIVE');
    });

    test('TEST 4: Filter members by status=ACTIVE and status=INACTIVE', async () => {
      // Set to INACTIVE first
      await request(app)
        .put(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      const inactiveRes = await request(app)
        .get('/api/v1/members?status=INACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(inactiveRes.status).toBe(200);
      const foundInactive = inactiveRes.body.data.some((m: any) => m.id === testMemberId);
      expect(foundInactive).toBe(true);

      const activeRes = await request(app)
        .get('/api/v1/members?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(activeRes.status).toBe(200);
      const foundActive = activeRes.body.data.some((m: any) => m.id === testMemberId);
      expect(foundActive).toBe(false);
    });

    test('TEST 5: Historical integrity — Changing status to INACTIVE preserves historical data', async () => {
      // Create session, attendance, fee, payment for test member
      const sessionDate = '2026-10-25';
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          session_date: sessionDate,
          month_key: '2026-10',
          member_ids: [testMemberId]
        });

      expect(sessionRes.status).toBe(201);
      const sessionId = sessionRes.body.data.id;

      // Update status to INACTIVE
      await request(app)
        .put(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      // Verify attendance record still exists 100% intact
      const attendanceRecord = db
        .prepare('SELECT * FROM playing_session_members WHERE session_id = ? AND member_id = ?')
        .get(sessionId, testMemberId);
      expect(attendanceRecord).toBeDefined();

      // Verify member record still exists in DB (NOT deleted)
      const memberRecord = db.prepare('SELECT * FROM members WHERE id = ?').get(testMemberId);
      expect(memberRecord).toBeDefined();
    });
  });
});
