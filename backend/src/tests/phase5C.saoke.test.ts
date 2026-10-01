import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';

describe('PHASE 5C — TASK 1: BACKEND PUBLIC SAOKE REPORT API TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    await runSeed(db);
    app = createApp(db);

    // Login as Admin to test auth isolation on protected route
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  /**
   * Helper function to scan response object recursively for any sensitive key
   */
  function assertNoSensitiveKeys(obj: any) {
    const forbiddenKeys = [
      'password',
      'passwordhash',
      'password_hash',
      'token',
      'accesstoken',
      'access_token',
      'refreshtoken',
      'refresh_token',
      'jwt',
      'authorization',
      'cookie',
      'session',
      'secret',
      'apikey',
      'api_key',
      'email',
      'phone',
      'mobile',
      'address'
    ];

    function scan(val: any, path = '') {
      if (!val || typeof val !== 'object') return;

      if (Array.isArray(val)) {
        val.forEach((item, index) => scan(item, `${path}[${index}]`));
        return;
      }

      Object.keys(val).forEach((key) => {
        const lowerKey = key.toLowerCase();
        expect(forbiddenKeys).not.toContain(lowerKey);
        scan(val[key], `${path}.${key}`);
      });
    }

    scan(obj);
  }

  describe('TEST GROUP A — PUBLIC ACCESS', () => {
    test('A1: GET /api/v1/public/saoke/monthly?month=2026-09 succeeds without Authorization header', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.month).toBe('2026-09');
    });

    test('A2: GET /api/v1/public/saoke/monthly with invalid Authorization header still succeeds', async () => {
      const res = await request(app)
        .get('/api/v1/public/saoke/monthly?month=2026-09')
        .set('Authorization', 'Bearer invalid_malformed_token_123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('TEST GROUP B — MONTH VALIDATION', () => {
    test('B1: Missing month parameter returns HTTP 400', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('B2: Invalid month formats return HTTP 400', async () => {
      const invalidMonths = [
        '2026',
        '2026-9',
        '26-09',
        '2026/09',
        '2026-00',
        '2026-13',
        '2026-99',
        'abc',
        '2026-09-01'
      ];

      for (const monthStr of invalidMonths) {
        const res = await request(app).get(`/api/v1/public/saoke/monthly?month=${monthStr}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    test('B3: Valid YYYY-MM months return HTTP 200', async () => {
      const validMonths = ['2026-01', '2026-09', '2026-12'];

      for (const monthStr of validMonths) {
        const res = await request(app).get(`/api/v1/public/saoke/monthly?month=${monthStr}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.month).toBe(monthStr);
      }
    });
  });

  describe('TEST GROUP C — DATA CORRECTNESS & STRUCTURE', () => {
    test('C1: Response matches expected public DTO structure', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data).toHaveProperty('month', '2026-09');
      expect(data).toHaveProperty('financial');
      expect(data.financial).toHaveProperty('openingBalance');
      expect(data.financial).toHaveProperty('totalIncome');
      expect(data.financial).toHaveProperty('totalExpense');
      expect(data.financial).toHaveProperty('endingBalance');

      expect(data).toHaveProperty('incomeBreakdown');
      expect(data.incomeBreakdown).toHaveProperty('FIXED_FUND');
      expect(data.incomeBreakdown).toHaveProperty('VISITOR_FEE');
      expect(data.incomeBreakdown).toHaveProperty('OTHER_INCOME');

      expect(data).toHaveProperty('expenseBreakdown');
      expect(data.expenseBreakdown).toHaveProperty('COURT_FEE');
      expect(data.expenseBreakdown).toHaveProperty('SHUTTLE_PURCHASE');
      expect(data.expenseBreakdown).toHaveProperty('OTHER_EXPENSE');

      expect(data).toHaveProperty('visitorFee');
      expect(data.visitorFee).toHaveProperty('due');
      expect(data.visitorFee).toHaveProperty('collected');
      expect(data.visitorFee).toHaveProperty('outstanding');
      expect(data.visitorFee).toHaveProperty('cashIncome');

      expect(data).toHaveProperty('activity');
      expect(data.activity).toHaveProperty('sessions');
      expect(data.activity).toHaveProperty('totalPlayers');
      expect(data.activity).toHaveProperty('shuttleUsed');
      expect(data.activity).toHaveProperty('currentInventory');
    });
  });

  describe('TEST GROUP D — PUBLIC DTO SECURITY (RECURSIVE SCAN)', () => {
    test('D1: Scans full response tree to ensure zero sensitive keys leak', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(res.status).toBe(200);
      assertNoSensitiveKeys(res.body);
    });
  });

  describe('TEST GROUP E — NO RAW ENTITY LEAK (ALLOW-LIST CHECK)', () => {
    test('E1: Response data contains ONLY public allow-listed top-level keys', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(res.status).toBe(200);

      const allowedTopLevelKeys = [
        'month',
        'financial',
        'incomeBreakdown',
        'expenseBreakdown',
        'visitorFee',
        'activity'
      ];
      const actualKeys = Object.keys(res.body.data);
      expect(actualKeys.sort()).toEqual(allowedTopLevelKeys.sort());
    });
  });

  describe('TEST GROUP F — AUTHENTICATION ISOLATION', () => {
    test('F1: Public route works without auth header, while protected route still returns 401', async () => {
      // 1. Public route succeeds
      const publicRes = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(publicRes.status).toBe(200);

      // 2. Protected admin route fails without auth
      const protectedRes = await request(app).get('/api/v1/reports/monthly?month=2026-09');
      expect(protectedRes.status).toBe(401);

      // 3. Protected admin route succeeds with valid admin JWT
      const protectedAdminRes = await request(app)
        .get('/api/v1/reports/monthly?month=2026-09')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(protectedAdminRes.status).toBe(200);
    });
  });

  describe('TEST GROUP G — READ-ONLY GUARANTEE', () => {
    test('G1: Repeated GET requests cause 0 database mutations or side effects', async () => {
      const countTables = () => {
        const counts: Record<string, number> = {};
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all() as { name: string }[];
        for (const t of tables) {
          const row = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any;
          counts[t.name] = row.c;
        }
        return counts;
      };

      const beforeCounts = countTables();

      // Make 5 consecutive requests
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
        expect(res.status).toBe(200);
      }

      const afterCounts = countTables();
      expect(afterCounts).toEqual(beforeCounts);
    });
  });

  describe('TEST GROUP H — SERVICE ERROR HANDLING', () => {
    test('H1: Malformed requests return standard error format without leaking stack trace or SQL', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=invalid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error).not.toHaveProperty('stack');
      expect(res.body.error).not.toHaveProperty('sql');
    });
  });

  describe('TEST GROUP I — MONTH ISOLATION', () => {
    test('I1: Querying month 2026-09 returns data isolated to 2026-09', async () => {
      const resSep = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      const resOct = await request(app).get('/api/v1/public/saoke/monthly?month=2026-10');

      expect(resSep.status).toBe(200);
      expect(resOct.status).toBe(200);
      expect(resSep.body.data.month).toBe('2026-09');
      expect(resOct.body.data.month).toBe('2026-10');
    });
  });

  describe('TEST GROUP J — FINANCIAL INTEGRITY', () => {
    test('J1: Public report total income equals sum of income categories', async () => {
      const res = await request(app).get('/api/v1/public/saoke/monthly?month=2026-09');
      expect(res.status).toBe(200);
      const data = res.body.data;

      const incomeSum =
        data.incomeBreakdown.FIXED_FUND.amount +
        data.incomeBreakdown.VISITOR_FEE.amount +
        data.incomeBreakdown.OTHER_INCOME.amount;
      expect(incomeSum).toBe(data.financial.totalIncome);

      const expenseSum =
        data.expenseBreakdown.COURT_FEE.amount +
        data.expenseBreakdown.SHUTTLE_PURCHASE.amount +
        data.expenseBreakdown.OTHER_EXPENSE.amount;
      expect(expenseSum).toBe(data.financial.totalExpense);

      expect(data.financial.endingBalance).toBe(
        data.financial.openingBalance + data.financial.totalIncome - data.financial.totalExpense
      );
    });
  });
});
