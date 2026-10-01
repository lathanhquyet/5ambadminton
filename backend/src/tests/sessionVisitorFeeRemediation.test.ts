import { getDb } from '../database/db';
import { runMigrations } from '../database/migrate';
import {
  addVisitorToSession,
  markVisitorFeePaid,
  updateVisitorFeeAmount,
  removeVisitorFromSession,
  getVisitorFeeSummary
} from '../services/visitorFeeService';
import { getMemberDebts } from '../services/feeEngine';
import { Database as DatabaseType } from 'better-sqlite3';

describe('SESSION-BASED VISITOR FEE & MEMBER-LEVEL DEBT AGGREGATION TEST SUITE', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = getDb(':memory:');
    runMigrations(db);

    // Seed test sessions
    db.prepare(`
      INSERT INTO playing_sessions (id, session_date, month_key, status, total_players, shuttle_used)
      VALUES 
        ('sess_20261001', '2026-10-01', '2026-10', 'OPEN', 0, 0),
        ('sess_20261003', '2026-10-03', '2026-10', 'OPEN', 0, 0),
        ('sess_20261005', '2026-10-05', '2026-10', 'OPEN', 0, 0)
    `).run();

    // Seed master visitor members
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
      VALUES 
        ('mem_v_dung', 'Dũng', '0901111111', 'VISITOR', 'ACTIVE', 0, '2026-10-01'),
        ('mem_v_hung', 'Hùng', '0902222222', 'VISITOR', 'ACTIVE', 0, '2026-10-01')
    `).run();
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('Test 1 — Same visitor, different fees across sessions', () => {
    addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_dung',
      amount: 50000,
      isPaid: false
    });

    addVisitorToSession(db, {
      sessionId: 'sess_20261003',
      memberId: 'mem_v_dung',
      amount: 40000,
      isPaid: false
    });

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt).toBeDefined();
    expect(dungDebt?.total_fee_required).toBe(90000);
    expect(dungDebt?.paid_amount).toBe(0);
    expect(dungDebt?.remaining_amount).toBe(90000);
    expect(dungDebt?.status).toBe('UNPAID');
  });

  test('Test 2 — One paid session, one unpaid session', () => {
    addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_dung',
      amount: 50000,
      isPaid: true
    });

    addVisitorToSession(db, {
      sessionId: 'sess_20261003',
      memberId: 'mem_v_dung',
      amount: 40000,
      isPaid: false
    });

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt?.total_fee_required).toBe(90000);
    expect(dungDebt?.paid_amount).toBe(50000);
    expect(dungDebt?.remaining_amount).toBe(40000);
    expect(dungDebt?.status).toBe('PARTIAL');

    const summary = getVisitorFeeSummary(db, '2026-10');
    expect(summary.visitor_fee_due).toBe(90000);
    expect(summary.visitor_fee_collected).toBe(50000);
    expect(summary.visitor_fee_outstanding).toBe(40000);
    expect(summary.cash_income).toBe(50000);
  });

  test('Test 3 — Edit unpaid visitor fee amount', () => {
    const res = addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_dung',
      amount: 50000,
      isPaid: false
    });

    updateVisitorFeeAmount(db, res.visitorFeeId, 70000);

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt?.remaining_amount).toBe(70000);

    const summary = getVisitorFeeSummary(db, '2026-10');
    expect(summary.visitor_fee_due).toBe(70000);
    expect(summary.visitor_fee_collected).toBe(0);
    expect(summary.cash_income).toBe(0);
  });

  test('Test 4 — Edit paid visitor fee attempt is BLOCKED', () => {
    const res = addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_dung',
      amount: 50000,
      isPaid: true
    });

    expect(() => {
      updateVisitorFeeAmount(db, res.visitorFeeId, 70000);
    }).toThrow('Không thể thay đổi số tiền của khoản phí vãng lai đã thanh toán (PAID).');

    // Historical income transaction remains 50,000
    const summary = getVisitorFeeSummary(db, '2026-10');
    expect(summary.cash_income).toBe(50000);
  });

  test('Test 5 — Multiple visitors in same session', () => {
    addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_dung',
      amount: 50000,
      isPaid: false
    });

    addVisitorToSession(db, {
      sessionId: 'sess_20261001',
      memberId: 'mem_v_hung',
      amount: 40000,
      isPaid: false
    });

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');
    const hungDebt = debts.find((d) => d.member_id === 'mem_v_hung');

    expect(dungDebt?.remaining_amount).toBe(50000);
    expect(hungDebt?.remaining_amount).toBe(40000);
  });

  test('Test 6 — Same visitor across 3 sessions (50k + 40k + 60k = 150k UNPAID)', () => {
    addVisitorToSession(db, { sessionId: 'sess_20261001', memberId: 'mem_v_dung', amount: 50000, isPaid: false });
    addVisitorToSession(db, { sessionId: 'sess_20261003', memberId: 'mem_v_dung', amount: 40000, isPaid: false });
    addVisitorToSession(db, { sessionId: 'sess_20261005', memberId: 'mem_v_dung', amount: 60000, isPaid: false });

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt?.total_fee_required).toBe(150000);
    expect(dungDebt?.remaining_amount).toBe(150000);
  });

  test('Test 7 — Pay one session of multi-session visitor', () => {
    addVisitorToSession(db, { sessionId: 'sess_20261001', memberId: 'mem_v_dung', amount: 50000, isPaid: false });
    const s2 = addVisitorToSession(db, { sessionId: 'sess_20261003', memberId: 'mem_v_dung', amount: 40000, isPaid: false });
    addVisitorToSession(db, { sessionId: 'sess_20261005', memberId: 'mem_v_dung', amount: 60000, isPaid: false });

    markVisitorFeePaid(db, s2.visitorFeeId, 'CASH');

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt?.total_fee_required).toBe(150000);
    expect(dungDebt?.paid_amount).toBe(40000);
    expect(dungDebt?.remaining_amount).toBe(110000);
  });

  test('Test 8 — Add existing visitor to new session reuses member_id', () => {
    const r1 = addVisitorToSession(db, { sessionId: 'sess_20261001', memberId: 'mem_v_dung', amount: 50000 });
    const r2 = addVisitorToSession(db, { sessionId: 'sess_20261003', memberId: 'mem_v_dung', amount: 40000 });

    expect(r1.memberId).toBe('mem_v_dung');
    expect(r2.memberId).toBe('mem_v_dung');

    const count = (db.prepare("SELECT COUNT(*) AS cnt FROM members WHERE full_name = 'Dũng'").get() as any).cnt;
    expect(count).toBe(1);
  });

  test('Test 9 — Remove unpaid visitor participation', () => {
    addVisitorToSession(db, { sessionId: 'sess_20261001', memberId: 'mem_v_dung', amount: 50000, isPaid: false });
    addVisitorToSession(db, { sessionId: 'sess_20261003', memberId: 'mem_v_dung', amount: 40000, isPaid: false });

    removeVisitorFromSession(db, 'sess_20261001', 'mem_v_dung');

    const debts = getMemberDebts(db, '2026-10');
    const dungDebt = debts.find((d) => d.member_id === 'mem_v_dung');

    expect(dungDebt?.remaining_amount).toBe(40000);

    const summary = getVisitorFeeSummary(db, '2026-10');
    expect(summary.cash_income).toBe(0);
  });

  test('Test 10 — Remove paid visitor participation is BLOCKED', () => {
    addVisitorToSession(db, { sessionId: 'sess_20261001', memberId: 'mem_v_dung', amount: 50000, isPaid: true });

    expect(() => {
      removeVisitorFromSession(db, 'sess_20261001', 'mem_v_dung');
    }).toThrow('Không thể xóa thành viên vãng lai đã thanh toán (PAID) khỏi buổi chơi.');
  });
});
