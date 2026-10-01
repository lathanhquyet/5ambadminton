import express from 'express';
import request from 'supertest';
import { Database as DatabaseType } from 'better-sqlite3';
import { getDb } from '../database/db';
import { runMigrations } from '../database/migrate';
import { isSessionLocked, bulkEditSessionHandler } from '../controllers/sessionController';
import { addVisitorToSession } from '../services/visitorFeeService';
import { getMemberDebts, recordMemberPayment, calculateMonthlyFixedFees } from '../services/feeEngine';

describe('BUG FIX — SESSION EDIT SAVE & UNIFIED DEBT PAYMENT TEST SUITE', () => {
  let db: DatabaseType;
  let app: express.Express;

  beforeEach(() => {
    db = getDb(':memory:');
    runMigrations(db);

    // Seed test admin user
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role)
      VALUES ('admin_test', 'admin_test', 'hash', 'ADMIN')
    `).run();

    app = express();
    app.use(express.json());

    // Auth middleware attached for testing
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 'admin_test', username: 'admin_test', role: 'ADMIN' };
      next();
    });

    app.post('/api/v1/sessions/:id/bulk-edit', bulkEditSessionHandler(db));

    // Seed members first
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
      VALUES 
        ('mem_fixed_1', 'Nam', '0901111111', 'FIXED', 'ACTIVE', 3, '2026-10-01'),
        ('mem_fixed_2', 'Tùng', '0902222222', 'FIXED', 'ACTIVE', 3, '2026-10-01'),
        ('mem_vis_dung', 'Dũng', '0903333333', 'VISITOR', 'ACTIVE', 0, '2026-10-01')
    `).run();

    // Calculate monthly fixed fees with 600,000 cost to allocate
    calculateMonthlyFixedFees(db, { monthKey: '2026-10', totalCostToAllocate: 600000 });

    // Seed test sessions with unique dates
    db.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status, total_players, shuttle_used)
      VALUES 
        ('sess_20261010', '2026-10-10', '2026-10', 'OPEN', 0, 0),
        ('sess_20261012', '2026-10-12', '2026-10', 'OPEN', 0, 0)
    `).run();
  });

  afterEach(() => {
    if (db) db.close();
  });

  describe('BUG 1 — SESSION LOCK DATE & BULK EDIT', () => {
    test('Case 1: playDate = 2026-10-01, currentDate = 2026-10-01 -> EDITABLE', () => {
      expect(isSessionLocked('2026-10-01', '2026-10-01')).toBe(false);
    });

    test('Case 2: playDate = 2026-10-01, currentDate = 2026-10-02 -> EDITABLE', () => {
      expect(isSessionLocked('2026-10-01', '2026-10-02')).toBe(false);
    });

    test('Case 3: playDate = 2026-10-01, currentDate = 2026-10-03 -> LOCKED', () => {
      expect(isSessionLocked('2026-10-01', '2026-10-03')).toBe(true);
    });

    test('Case 4: playDate = 2026-10-01, currentDate = 2026-10-04 -> LOCKED', () => {
      expect(isSessionLocked('2026-10-01', '2026-10-04')).toBe(true);
    });

    test('Backend rejects bulk-edit request when session is locked', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/sess_20261010/bulk-edit')
        .send({
          current_date: '2026-10-12', // 2 days after playDate => locked
          attendance: [
            { member_id: 'mem_fixed_1', attendance_status: 'PRESENT' }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SESSION_LOCKED');
    });

    test('Bulk edit updates multiple members attendance atomically in 1 operation', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/sess_20261010/bulk-edit')
        .send({
          current_date: '2026-10-10',
          attendance: [
            { member_id: 'mem_fixed_1', attendance_status: 'PRESENT' },
            { member_id: 'mem_fixed_2', attendance_status: 'PRESENT' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const attendanceRecords = db
        .prepare('SELECT member_id, attendance_status FROM playing_session_members WHERE session_id = ?')
        .all('sess_20261010') as any[];

      expect(attendanceRecords).toHaveLength(2);
      expect(attendanceRecords.map((r) => r.attendance_status)).toEqual(['PRESENT', 'PRESENT']);
    });
  });

  describe('BUG 2 — UNIFIED DEBT PAYMENT & VISITOR DEBT ALLOCATION', () => {
    test('Debt 30.000 + Payment 30.000 for Visitor = PASS (No false 30k > 0 debt rejection)', () => {
      addVisitorToSession(db, {
        sessionId: 'sess_20261010',
        memberId: 'mem_vis_dung',
        amount: 30000,
        isPaid: false
      });

      const debts = getMemberDebts(db, '2026-10');
      const dungDebt = debts.find((d) => d.member_id === 'mem_vis_dung');
      expect(dungDebt?.remaining_amount).toBe(30000);

      // Record payment of 30,000 for visitor Dũng
      const paymentResult = recordMemberPayment(db, {
        memberId: 'mem_vis_dung',
        monthKey: '2026-10',
        paymentDate: '2026-10-10',
        amount: 30000,
        paymentMethod: 'CASH',
        notes: 'Thanh toán phí vãng lai'
      });

      expect(paymentResult.amountPaid).toBe(30000);

      // Verify fee status is PAID
      const feeRow = db
        .prepare('SELECT status FROM session_visitor_fees WHERE member_id = ? AND session_id = ?')
        .get('mem_vis_dung', 'sess_20261010') as any;
      expect(feeRow.status).toBe('PAID');

      // Verify income transaction created with VISITOR_FEE category
      const txRow = db
        .prepare("SELECT * FROM income_transactions WHERE category = 'VISITOR_FEE' AND member_id = ?")
        .get('mem_vis_dung') as any;
      expect(txRow).toBeDefined();
      expect(txRow.original_amount).toBe(30000);

      // Total remaining debt should now be 0
      const debtsAfter = getMemberDebts(db, '2026-10');
      const dungDebtAfter = debtsAfter.find((d) => d.member_id === 'mem_vis_dung');
      expect(dungDebtAfter?.remaining_amount).toBe(0);
    });

    test('Visitor multi-session aggregate debt payment (5 sessions x 50.000 = 250.000) = PASS', () => {
      // Create 5 sessions with unique dates (2026-10-20 to 2026-10-24)
      for (let i = 1; i <= 5; i++) {
        const sId = `sess_multi_${i}`;
        const sDate = `2026-10-${20 + i}`;
        db.prepare(`
          INSERT INTO playing_sessions (id, session_date, month_key, status, total_players, shuttle_used)
          VALUES (?, ?, '2026-10', 'OPEN', 0, 0)
        `).run(sId, sDate);

        addVisitorToSession(db, {
          sessionId: sId,
          memberId: 'mem_vis_dung',
          amount: 50000,
          isPaid: false
        });
      }

      const debts = getMemberDebts(db, '2026-10');
      const dungDebt = debts.find((d) => d.member_id === 'mem_vis_dung');
      expect(dungDebt?.remaining_amount).toBe(250000);

      // Record full payment of 250,000
      recordMemberPayment(db, {
        memberId: 'mem_vis_dung',
        monthKey: '2026-10',
        paymentDate: '2026-10-25',
        amount: 250000,
        paymentMethod: 'BANK_TRANSFER'
      });

      // Verify all visitor fees are PAID
      const unpaidFees = db
        .prepare("SELECT COUNT(*) AS cnt FROM session_visitor_fees WHERE member_id = ? AND status = 'UNPAID'")
        .get('mem_vis_dung') as any;
      expect(unpaidFees.cnt).toBe(0);

      // Debt after is 0
      const debtsAfter = getMemberDebts(db, '2026-10');
      const dungDebtAfter = debtsAfter.find((d) => d.member_id === 'mem_vis_dung');
      expect(dungDebtAfter?.remaining_amount).toBe(0);
    });

    test('Fixed Member payment regression test (Debt X, Payment X = PASS)', () => {
      const debts = getMemberDebts(db, '2026-10');
      const namDebt = debts.find((d) => d.member_id === 'mem_fixed_1');
      expect(namDebt).toBeDefined();
      const debtAmount = namDebt!.remaining_amount;
      expect(debtAmount).toBeGreaterThan(0);

      const paymentResult = recordMemberPayment(db, {
        memberId: 'mem_fixed_1',
        monthKey: '2026-10',
        paymentDate: '2026-10-01',
        amount: debtAmount,
        paymentMethod: 'BANK_TRANSFER'
      });

      expect(paymentResult.amountPaid).toBe(debtAmount);
      expect(paymentResult.remainingDebtAfter).toBe(0);
    });
  });
});
