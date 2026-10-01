import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { calculateExpectedDays, roundupToThousand } from '../services/businessFormula';
import { getCashLedgerSummary, getInventoryCarryForward } from '../services/cashLedgerService';
import { getCurrentStockInPieces } from '../services/inventoryService';

describe('DEEP FULL REGRESSION AUDIT (PHASE 1 -> PHASE 4)', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  // ==========================================
  // SECTION II: PHASE 1 — FOUNDATION / DB / AUTH / MEMBER
  // ==========================================
  describe('II. PHASE 1 DEEP AUDIT', () => {
    test('A. Database FK & Constraints Verification', () => {
      const fkCheck = db.pragma('foreign_keys', { simple: true });
      expect(fkCheck).toBe(1);

      // Verify FK constraint rejection
      expect(() => {
        db.prepare(`
          INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, remaining_amount)
          VALUES ('fee_fk_test', '2026-09', 'non_existent_member', 'FIXED_FUND', 100, 100, 100)
        `).run();
      }).toThrow();
    });

    test('B. Member Validation Boundaries (days_per_week)', async () => {
      const invalidValues = [-1, 8, 3.5, 'abc'];

      for (const val of invalidValues) {
        const res = await request(app)
          .post('/api/v1/members')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            full_name: `Invalid Member ${val}`,
            member_type: 'FIXED',
            days_per_week: val,
            joined_date: '2026-09-01'
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_DAYS_PER_WEEK');
      }

      // Valid boundary values 0..7
      for (let i = 0; i <= 7; i++) {
        const res = await request(app)
          .post('/api/v1/members')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            full_name: `Valid Member ${i}`,
            member_type: 'FIXED',
            days_per_week: i,
            joined_date: '2026-09-01'
          });

        expect(res.status).toBe(201);
        expect(res.body.data.days_per_week).toBe(i);
      }
    });

    test('C. Expected Days Matrix Across Month Lengths & Leap Years', () => {
      // 02/2026 (28 days, non-leap)
      expect(calculateExpectedDays(5, 2026, 2)).toBe(20); // Math.ceil(5 * 28 / 7) = 20
      expect(calculateExpectedDays(0, 2026, 2)).toBe(0);

      // 02/2028 (29 days, leap)
      expect(calculateExpectedDays(5, 2028, 2)).toBe(21); // Math.ceil(5 * 29 / 7) = 21

      // 04/2026 (30 days)
      expect(calculateExpectedDays(5, 2026, 4)).toBe(22); // Math.ceil(5 * 30 / 7) = 22

      // 10/2026 (31 days)
      expect(calculateExpectedDays(5, 2026, 10)).toBe(23); // Math.ceil(5 * 31 / 7) = 23
    });

    test('D. Auth / Security / RBAC', async () => {
      // Wrong password
      const wrongPass = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'wrong' });
      expect(wrongPass.status).toBe(401);

      // Malformed JWT
      const badJwt = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid_jwt');
      expect(badJwt.status).toBe(401);

      // Missing JWT
      const noJwt = await request(app).get('/api/v1/auth/me');
      expect(noJwt.status).toBe(401);
    });
  });

  // ==========================================
  // SECTION III: PHASE 2 — SESSIONS / ATTENDANCE / INVENTORY
  // ==========================================
  describe('III. PHASE 2 DEEP AUDIT', () => {
    test('A. Session Duplicate & Attendance Total Players Integrity', async () => {
      const sessionDate = '2026-09-20';

      const s1 = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ session_date: sessionDate });
      expect(s1.status).toBe(201);
      const sessionId = s1.body.data.id;

      // Duplicate date -> 400
      const s2 = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ session_date: sessionDate });
      expect(s2.status).toBe(400);

      // Create member & add attendance
      const mRes = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ full_name: 'Att Member 1', member_type: 'FIXED', days_per_week: 3, joined_date: '2026-09-01' });

      const memberId = mRes.body.data.id;

      await request(app)
        .post(`/api/v1/sessions/${sessionId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ member_id: memberId, attendance_status: 'PRESENT', current_date: sessionDate });

      const updatedS = db.prepare('SELECT total_players FROM playing_sessions WHERE id = ?').get(sessionId) as any;
      expect(updatedS.total_players).toBe(1);

      // Toggle to ABSENT -> total_players decreases to 0
      await request(app)
        .post(`/api/v1/sessions/${sessionId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ member_id: memberId, attendance_status: 'ABSENT', current_date: sessionDate });

      const updatedS2 = db.prepare('SELECT total_players FROM playing_sessions WHERE id = ?').get(sessionId) as any;
      expect(updatedS2.total_players).toBe(0);
    });

    test('B. Shuttle Usage & Cancellation Refund Idempotency', async () => {
      const sessionDate = '2026-09-21';
      const sRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ session_date: sessionDate });
      const sessionId = sRes.body.data.id;

      // Restock inventory with 50 pieces
      db.prepare(`
        INSERT INTO inventory_transactions (id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces, total_amount)
        VALUES ('inv_stock_50', '2026-09-01', '2026-09', 'prod_tc77', 'RECEIPT', 50, 500000)
      `).run();

      const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

      // Record 5 shuttle usage
      await request(app)
        .put(`/api/v1/sessions/${sessionId}/shuttle-usage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shuttle_used: 5, current_date: sessionDate });

      expect(getCurrentStockInPieces(db, 'prod_tc77')).toBe(stockBefore - 5);

      // Cancel session -> refunds 5 shuttles
      await request(app)
        .put(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED', current_date: sessionDate });

      expect(getCurrentStockInPieces(db, 'prod_tc77')).toBe(stockBefore);

      // Second cancel call -> idempotent, no additional refund
      await request(app)
        .put(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED', current_date: sessionDate });

      expect(getCurrentStockInPieces(db, 'prod_tc77')).toBe(stockBefore);
    });
  });

  // ==========================================
  // SECTION IV: PHASE 3 — FEE / DEBT / PAYMENT
  // ==========================================
  describe('IV. PHASE 3 DEEP AUDIT', () => {
    test('A. Rounding Edge Cases (ROUNDUP to 1,000 VND)', () => {
      const testCases = [
        { input: 0, expected: 0 },
        { input: 1, expected: 1000 },
        { input: 999, expected: 1000 },
        { input: 1000, expected: 1000 },
        { input: 1001, expected: 2000 },
        { input: 1999, expected: 2000 },
        { input: 2000, expected: 2000 },
        { input: 774100, expected: 775000 },
        { input: 774999, expected: 775000 },
        { input: 775000, expected: 775000 },
        { input: 775001, expected: 776000 },
        { input: 999999, expected: 1000000 },
        { input: 1000000, expected: 1000000 }
      ];

      for (const tc of testCases) {
        expect(roundupToThousand(tc.input)).toBe(tc.expected);
      }
    });

    test('B. Debt & Payment Allocation & Overpayment Rejection', async () => {
      const mRes = await request(app)
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ full_name: 'Debt Member', member_type: 'FIXED', days_per_week: 5, joined_date: '2026-09-01' });
      const memberId = mRes.body.data.id;

      // Create member fee required 500,000
      db.prepare(`
        INSERT INTO member_fees (id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status)
        VALUES ('fee_debt_test', '2026-09', ?, 'FIXED_FUND', 500000, 500000, 0, 500000, 'UNPAID')
      `).run(memberId);

      // Overpayment (600,000 > 500,000) -> HTTP 400 PAYMENT_EXCEEDS_DEBT
      const overPay = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          member_id: memberId,
          month_key: '2026-09',
          payment_date: '2026-09-05',
          amount: 600000
        });

      expect(overPay.status).toBe(400);
      expect(overPay.body.error.code).toBe('PAYMENT_EXCEEDS_DEBT');

      // Valid payment 200,000 -> PARTIAL
      const pay1 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          member_id: memberId,
          month_key: '2026-09',
          payment_date: '2026-09-05',
          amount: 200000,
          bank_tx_code: 'TX_UNIQUE_101'
        });

      expect(pay1.status).toBe(200);

      const feeAfterPay1 = db.prepare('SELECT * FROM member_fees WHERE id = ?').get('fee_debt_test') as any;
      expect(feeAfterPay1.paid_amount).toBe(200000);
      expect(feeAfterPay1.remaining_amount).toBe(300000);
      expect(feeAfterPay1.fee_status).toBe('PARTIAL');

      // Duplicate payment retry with same bank_tx_code -> 400 DUPLICATE_PAYMENT
      const payRetry = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          member_id: memberId,
          month_key: '2026-09',
          payment_date: '2026-09-05',
          amount: 200000,
          bank_tx_code: 'TX_UNIQUE_101'
        });

      expect(payRetry.status).toBe(400);
      expect(payRetry.body.error.code).toBe('DUPLICATE_PAYMENT');
    });
  });

  // ==========================================
  // SECTION V & VI: CROSS-PHASE & FULL MONTH SIMULATION
  // ==========================================
  describe('VI. REAL-WORLD MULTI-MONTH OPERATION SIMULATION', () => {
    test('Simulate Month 09/2026 & Month 10/2026 Full Lifecycle', async () => {
      // 1. Setup Month 09/2026
      const monthKey = '2026-09';

      // Shuttle Purchase: 10 tubes @ 600,000 = 6,000,000
      await request(app)
        .post('/api/v1/transactions/shuttle-purchase')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchase_date: '2026-09-02',
          month_key: monthKey,
          supplier: 'Super Sports',
          tubes_qty: 10,
          price_per_tube: 600000
        });

      // Court Fee: 300,000 * 10 days = 3,000,000
      await request(app)
        .post('/api/v1/transactions/court-fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month_key: monthKey,
          price_per_day: 300000,
          total_days: 10,
          total_courts: 1
        });

      const summary09 = getCashLedgerSummary(db, monthKey);
      expect(summary09.total_expense).toBe(9000000); // 6m + 3m = 9m

      // Month 10/2026 Carry Forward Verification
      const summary10 = getCashLedgerSummary(db, '2026-10');
      expect(summary10.opening_balance).toBe(summary09.ending_balance);
    });
  });

  // ==========================================
  // SECTION X: DATABASE INTEGRITY AUDIT
  // ==========================================
  describe('X. DATABASE INTEGRITY AUDIT QUERIES', () => {
    test('Verify zero orphan records and strict relational integrity', () => {
      // 1. Orphan payment allocations
      const orphanAllocations = (
        db.prepare(`
          SELECT COUNT(*) AS cnt FROM payment_allocations pa
          LEFT JOIN payments p ON pa.payment_id = p.id
          WHERE p.id IS NULL
        `).get() as any
      ).cnt;
      expect(orphanAllocations).toBe(0);

      // 2. Orphan member fees in allocations
      const orphanFeeAllocations = (
        db.prepare(`
          SELECT COUNT(*) AS cnt FROM payment_allocations pa
          LEFT JOIN member_fees mf ON pa.member_fee_id = mf.id
          WHERE mf.id IS NULL
        `).get() as any
      ).cnt;
      expect(orphanFeeAllocations).toBe(0);

      // 3. Negative inventory transactions
      const negativePurchases = (
        db.prepare("SELECT COUNT(*) AS cnt FROM shuttle_purchases WHERE tubes_qty <= 0 OR price_per_tube <= 0").get() as any
      ).cnt;
      expect(negativePurchases).toBe(0);

      // 4. Mismatched allocations vs payment amount
      const mismatchedPayments = (
        db.prepare(`
          SELECT COUNT(*) AS cnt FROM payments p
          JOIN (
            SELECT payment_id, SUM(allocated_amount) AS total_alloc
            FROM payment_allocations GROUP BY payment_id
          ) alloc ON p.id = alloc.payment_id
          WHERE p.rounded_amount != alloc.total_alloc
        `).get() as any
      ).cnt;
      expect(mismatchedPayments).toBe(0);
    });
  });

  // ==========================================
  // SECTION XIII: STRESS & SANITY TEST
  // ==========================================
  describe('XIII. STRESS & SANITY TEST', () => {
    test('High volume member & transaction insertion sanity check', () => {
      const insertStmt = db.prepare(`
        INSERT INTO members (id, full_name, member_type, status, days_per_week, joined_date)
        VALUES (?, ?, 'FIXED', 'ACTIVE', 5, '2026-09-01')
      `);

      const insertMany = db.transaction((count: number) => {
        for (let i = 0; i < count; i++) {
          insertStmt.run(`stress_mem_${i}`, `Stress Member ${i}`);
        }
      });

      insertMany(100);

      const count = (db.prepare("SELECT COUNT(*) AS cnt FROM members WHERE id LIKE 'stress_mem_%'").get() as any).cnt;
      expect(count).toBe(100);
    });
  });
});
