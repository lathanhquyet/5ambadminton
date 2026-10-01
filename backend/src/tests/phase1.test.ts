import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { calculateExpectedDays, roundupToThousand } from '../services/businessFormula';

describe('PHASE 1 INTEGRATION & BUSINESS LOGIC TESTS', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    // Create an in-memory SQLite database for test isolation
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Seed initial admin user and default product
    await runSeed(db);
    app = createApp(db);

    // Login to obtain JWT Token for Admin APIs
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe('1. Database Migration & Schema Verification', () => {
    test('Verifies that all 20 tables exist in SQLite database', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      const expectedTables = [
        'users',
        'members',
        'member_month_snapshots',
        'playing_sessions',
        'playing_session_members',
        'inventory_products',
        'inventory_transactions',
        'inventory_monthly_balances',
        'fee_configs',
        'member_fees',
        'payments',
        'payment_allocations',
        'income_transactions',
        'expense_transactions',
        'shuttle_purchases',
        'court_fee_configs',
        'bank_accounts',
        'monthly_closings',
        'monthly_report_snapshots',
        'audit_logs'
      ];

      expectedTables.forEach((tableName) => {
        expect(tableNames).toContain(tableName);
      });

      expect(expectedTables.length).toBe(20);
    });
  });

  describe('2. Business Formula Unit Tests (Mandatory Requirements)', () => {
    test('Mandatory Requirement: October 2026, 5 days/week = 23 expected playing days', () => {
      const daysPerWeek = 5;
      const year = 2026;
      const month = 10; // 31 days
      const result = calculateExpectedDays(daysPerWeek, year, month);

      // Math.ceil(5 * 31 / 7) = Math.ceil(22.142857) = 23
      expect(result).toBe(23);
    });

    test('Financial Rounding: ROUNDUP to 1,000 VND', () => {
      expect(roundupToThousand(774100)).toBe(775000);
      expect(roundupToThousand(774999)).toBe(775000);
      expect(roundupToThousand(775000)).toBe(775000);
      expect(roundupToThousand(775001)).toBe(776000);
      expect(roundupToThousand(1001)).toBe(2000);
      expect(roundupToThousand(0)).toBe(0);
    });
  });

  describe('3. Auth API Integration Tests', () => {
    test('POST /api/v1/auth/login - Fails with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('GET /api/v1/auth/me - Succeeds with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('admin');
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    test('GET /api/v1/auth/me - Fails without authorization header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Member Management API Integration Tests', () => {
    let createdMemberId: string;

    test('GET /api/v1/members - Fails without Token', async () => {
      const res = await request(app).get('/api/v1/members');
      expect(res.status).toBe(401);
    });

    test('POST /api/v1/members - Creates a Fixed Member (5 days/week)', async () => {
      const res = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Nguyen Van Fixed',
          phone: '0901234567',
          email: 'fixed@example.com',
          member_type: 'FIXED',
          days_per_week: 5,
          joined_date: '2026-09-01',
          notes: 'Thành viên cố định 5 buổi'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.full_name).toBe('Nguyen Van Fixed');
      expect(res.body.data.days_per_week).toBe(5);

      createdMemberId = res.body.data.id;
    });

    test('GET /api/v1/members?year=2026&month=10 - Calculates expected_days = 23 for fixed member', async () => {
      const res = await request(app)
        .get('/api/v1/members?year=2026&month=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const targetMember = res.body.data.find((m: any) => m.id === createdMemberId);
      expect(targetMember).toBeDefined();
      expect(targetMember.days_per_week).toBe(5);
      expect(targetMember.expected_days).toBe(23); // Math.ceil(5 * 31 / 7) = 23
    });

    test('PUT /api/v1/members/:id - Updates member details', async () => {
      const res = await request(app)
        .put(`/api/v1/members/${createdMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          days_per_week: 4
        });

      expect(res.status).toBe(200);
      expect(res.body.data.days_per_week).toBe(4);
    });

    test('DELETE /api/v1/members/:id - Soft deletes member to INACTIVE', async () => {
      const res = await request(app)
        .delete(`/api/v1/members/${createdMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/members/${createdMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.body.data.status).toBe('INACTIVE');
    });
  });
});
