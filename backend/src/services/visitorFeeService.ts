import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { assertMonthNotClosed } from './feeEngine';

export interface AddVisitorParams {
  sessionId: string;
  memberId?: string;
  fullName?: string;
  phone?: string;
  amount?: number; // Default 50,000, EXACT INPUT, NO ROUNDING
  isPaid?: boolean;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

export interface VisitorFeeSummary {
  month_key: string;
  visitor_fee_due: number;
  visitor_fee_collected: number;
  visitor_fee_outstanding: number;
  cash_income: number;
}

/**
 * Adds a Visitor to a Playing Session and creates associated Visitor Fee record.
 * NO ROUNDUP for Visitor Fee.
 */
export function addVisitorToSession(dbInstance: DatabaseType | undefined, params: AddVisitorParams) {
  const db = dbInstance || defaultDb;
  const { sessionId, memberId, fullName, phone, amount = 50000, isPaid = false, paymentMethod = 'CASH', notes, userId } = params;

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) {
    throw new Error('Buổi chơi không tồn tại.');
  }

  if (session.status === 'CANCELLED') {
    throw new Error('Không thể thêm thành viên vãng lai vào buổi chơi đã HỦY (CANCELLED).');
  }

  assertMonthNotClosed(db, session.month_key);

  if (amount < 0) {
    throw new Error('Phí vãng lai không được là số âm.');
  }

  let finalMemberId = memberId;
  let memberName = fullName;

  const runAtomic = db.transaction(() => {
    // 1. Resolve or create Member
    if (finalMemberId) {
      const existingMember = db.prepare('SELECT * FROM members WHERE id = ?').get(finalMemberId) as any;
      if (!existingMember) {
        throw new Error('Thành viên vãng lai không tồn tại.');
      }
      memberName = existingMember.full_name;
    } else {
      if (!fullName || fullName.trim() === '') {
        throw new Error('Tên thành viên vãng lai là bắt buộc.');
      }
      finalMemberId = 'mem_v_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date, notes)
        VALUES (?, ?, ?, 'VISITOR', 'ACTIVE', 0, ?, ?)
      `).run(finalMemberId, fullName, phone || null, session.session_date, notes || 'Khách vãng lai tự động tạo');
    }

    // 2. Add attendance to playing_session_members if not present
    const existingPsm = db
      .prepare('SELECT * FROM playing_session_members WHERE session_id = ? AND member_id = ?')
      .get(sessionId, finalMemberId) as any;

    if (!existingPsm) {
      const psmId = 'psm_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO playing_session_members (id, session_id, member_id, attendance_status, checked_by)
        VALUES (?, ?, ?, 'PRESENT', ?)
      `).run(psmId, sessionId, finalMemberId, userId || null);

      // Recalculate total_players
      const presentCount = (
        db
          .prepare("SELECT COUNT(*) AS cnt FROM playing_session_members WHERE session_id = ? AND attendance_status = 'PRESENT'")
          .get(sessionId) as any
      ).cnt;

      db.prepare('UPDATE playing_sessions SET total_players = ? WHERE id = ?').run(presentCount, sessionId);
    }

    // 3. Create or update session_visitor_fees
    const existingFee = db
      .prepare('SELECT * FROM session_visitor_fees WHERE session_id = ? AND member_id = ?')
      .get(sessionId, finalMemberId) as any;

    if (existingFee) {
      if (isPaid && existingFee.status !== 'PAID') {
        const incTxId = 'inc_v_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO income_transactions (
            id, transaction_date, month_key, category, description, member_id,
            original_amount, rounded_amount, payment_method, is_void, created_by
          ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, ?, 0, ?)
        `).run(
          incTxId,
          session.session_date,
          session.month_key,
          `Phí vãng lai buổi ${session.session_date} - ${memberName}`,
          finalMemberId,
          amount,
          amount, // EXACT AMOUNT, NO ROUNDING
          paymentMethod,
          userId || null
        );

        db.prepare(`
          UPDATE session_visitor_fees
          SET status = 'PAID', amount = ?, income_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(amount, incTxId, existingFee.id);

        return {
          visitorFeeId: existingFee.id,
          memberId: finalMemberId,
          sessionId,
          amount,
          status: 'PAID',
          incomeTransactionId: incTxId
        };
      }

      return {
        visitorFeeId: existingFee.id,
        memberId: finalMemberId,
        sessionId,
        amount: existingFee.amount,
        status: existingFee.status,
        incomeTransactionId: existingFee.income_transaction_id
      };
    }

    const feeId = 'svf_' + Math.random().toString(36).substring(2, 10);
    let incTxId: string | null = null;

    if (isPaid) {
      incTxId = 'inc_v_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO income_transactions (
          id, transaction_date, month_key, category, description, member_id,
          original_amount, rounded_amount, payment_method, is_void, created_by
        ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, ?, 0, ?)
      `).run(
        incTxId,
        session.session_date,
        session.month_key,
        `Phí vãng lai buổi ${session.session_date} - ${memberName}`,
        finalMemberId,
        amount,
        amount, // EXACT AMOUNT, NO ROUNDING
        paymentMethod,
        userId || null
      );
    }

    db.prepare(`
      INSERT INTO session_visitor_fees (
        id, session_id, member_id, amount, status, income_transaction_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      feeId,
      sessionId,
      finalMemberId,
      amount,
      isPaid ? 'PAID' : 'UNPAID',
      incTxId,
      notes || null
    );

    return {
      visitorFeeId: feeId,
      memberId: finalMemberId,
      sessionId,
      amount,
      status: isPaid ? 'PAID' : 'UNPAID',
      incomeTransactionId: incTxId
    };
  });

  return runAtomic();
}

/**
 * Marks an unpaid visitor fee as PAID (Thu sau).
 * Creates income_transaction (Category: VISITOR_FEE).
 * Is IDEMPOTENT.
 */
export function markVisitorFeePaid(
  dbInstance: DatabaseType | undefined,
  visitorFeeId: string,
  paymentMethod: 'CASH' | 'BANK_TRANSFER' = 'CASH',
  notes?: string,
  userId?: string
) {
  const db = dbInstance || defaultDb;

  const fee = db.prepare('SELECT * FROM session_visitor_fees WHERE id = ?').get(visitorFeeId) as any;
  if (!fee) {
    throw new Error('Khoản phí vãng lai không tồn tại.');
  }

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(fee.session_id) as any;
  assertMonthNotClosed(db, session.month_key);

  if (fee.status === 'PAID' && fee.income_transaction_id) {
    const existingTx = db.prepare('SELECT id FROM income_transactions WHERE id = ? AND is_void = 0').get(fee.income_transaction_id);
    if (existingTx) {
      return {
        visitorFeeId,
        status: 'PAID',
        amount: fee.amount,
        incomeTransactionId: fee.income_transaction_id
      };
    }
  }

  const member = db.prepare('SELECT full_name FROM members WHERE id = ?').get(fee.member_id) as any;
  const memberName = member ? member.full_name : 'Khách vãng lai';

  const runAtomic = db.transaction(() => {
    const incTxId = 'inc_v_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO income_transactions (
        id, transaction_date, month_key, category, description, member_id,
        original_amount, rounded_amount, payment_method, is_void, created_by
      ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, ?, 0, ?)
    `).run(
      incTxId,
      session.session_date,
      session.month_key,
      `Phí vãng lai buổi ${session.session_date} - ${memberName}`,
      fee.member_id,
      fee.amount,
      fee.amount, // EXACT AMOUNT, NO ROUNDING
      paymentMethod,
      userId || null
    );

    db.prepare(`
      UPDATE session_visitor_fees
      SET status = 'PAID', income_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(incTxId, visitorFeeId);

    return {
      visitorFeeId,
      status: 'PAID',
      amount: fee.amount,
      incomeTransactionId: incTxId
    };
  });

  return runAtomic();
}

/**
 * Updates visitor fee amount on session_visitor_fees and syncs income_transaction if paid.
 * NO ROUNDING.
 */
export function updateVisitorFeeAmount(
  dbInstance: DatabaseType | undefined,
  visitorFeeId: string,
  newAmount: number,
  userId?: string
) {
  const db = dbInstance || defaultDb;

  if (newAmount < 0) {
    throw new Error('Số tiền phí vãng lai không được là số âm.');
  }

  const fee = db.prepare('SELECT * FROM session_visitor_fees WHERE id = ?').get(visitorFeeId) as any;
  if (!fee) throw new Error('Khoản phí vãng lai không tồn tại.');

  if (fee.status === 'PAID') {
    throw new Error('Không thể thay đổi số tiền của khoản phí vãng lai đã thanh toán (PAID).');
  }

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(fee.session_id) as any;
  assertMonthNotClosed(db, session.month_key);

  const runAtomic = db.transaction(() => {
    db.prepare(`
      UPDATE session_visitor_fees
      SET amount = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAmount, visitorFeeId);

    if (fee.income_transaction_id) {
      db.prepare(`
        UPDATE income_transactions
        SET original_amount = ?, rounded_amount = ?
        WHERE id = ?
      `).run(newAmount, newAmount, fee.income_transaction_id);
    }

    return {
      visitorFeeId,
      newAmount
    };
  });

  return runAtomic();
}

/**
 * Removes a visitor from a session.
 * If UNPAID, deletes visitor fee record and attendance.
 * If PAID, direct removal is BLOCKED to preserve historical financial records.
 */
export function removeVisitorFromSession(
  dbInstance: DatabaseType | undefined,
  sessionId: string,
  memberId: string,
  userId?: string
) {
  const db = dbInstance || defaultDb;

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) throw new Error('Buổi chơi không tồn tại.');
  assertMonthNotClosed(db, session.month_key);

  const fee = db
    .prepare('SELECT * FROM session_visitor_fees WHERE session_id = ? AND member_id = ?')
    .get(sessionId, memberId) as any;

  if (fee && fee.status === 'PAID') {
    throw new Error('Không thể xóa thành viên vãng lai đã thanh toán (PAID) khỏi buổi chơi.');
  }

  const runAtomic = db.transaction(() => {
    // Remove attendance
    db.prepare('DELETE FROM playing_session_members WHERE session_id = ? AND member_id = ?').run(sessionId, memberId);

    // Recalculate total_players
    const presentCount = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM playing_session_members WHERE session_id = ? AND attendance_status = 'PRESENT'")
        .get(sessionId) as any
    ).cnt;
    db.prepare('UPDATE playing_sessions SET total_players = ? WHERE id = ?').run(presentCount, sessionId);

    // Handle visitor fee deletion for UNPAID
    if (fee && fee.status === 'UNPAID') {
      db.prepare('DELETE FROM session_visitor_fees WHERE id = ?').run(fee.id);
    }

    return {
      sessionId,
      memberId,
      removed: true
    };
  });

  return runAtomic();
}

/**
 * Calculates Visitor Fee Summary metrics for a month.
 */
export function getVisitorFeeSummary(dbInstance: DatabaseType | undefined, monthKey: string): VisitorFeeSummary {
  const db = dbInstance || defaultDb;

  const dueRes = db
    .prepare(`
      SELECT COALESCE(SUM(svf.amount), 0) AS total_due
      FROM session_visitor_fees svf
      JOIN playing_sessions s ON svf.session_id = s.id
      WHERE s.month_key = ? AND s.status != 'CANCELLED'
    `)
    .get(monthKey) as { total_due: number };

  const collectedRes = db
    .prepare(`
      SELECT COALESCE(SUM(svf.amount), 0) AS total_collected
      FROM session_visitor_fees svf
      JOIN playing_sessions s ON svf.session_id = s.id
      WHERE s.month_key = ? AND s.status != 'CANCELLED' AND svf.status = 'PAID'
    `)
    .get(monthKey) as { total_collected: number };

  const cashIncomeRes = db
    .prepare(`
      SELECT COALESCE(SUM(rounded_amount), 0) AS cash_inc
      FROM income_transactions
      WHERE month_key = ? AND category = 'VISITOR_FEE' AND is_void = 0
    `)
    .get(monthKey) as { cash_inc: number };

  const totalDue = dueRes ? dueRes.total_due : 0;
  const totalCollected = collectedRes ? collectedRes.total_collected : 0;
  const outstanding = totalDue - totalCollected;
  const cashIncome = cashIncomeRes ? cashIncomeRes.cash_inc : 0;

  return {
    month_key: monthKey,
    visitor_fee_due: totalDue,
    visitor_fee_collected: totalCollected,
    visitor_fee_outstanding: outstanding,
    cash_income: cashIncome
  };
}

/**
 * Visitor clicks "Xác nhận đã đóng" on /saoke:
 * Transitions UNPAID visitor fees for member in monthKey to PAYMENT_REQUESTED.
 * ZERO financial mutation (0 income created, 0 debt reduction).
 * Returns count of fees updated.
 */
export function requestVisitorPayment(
  dbInstance: DatabaseType | undefined,
  memberId: string,
  monthKey: string
) {
  const db = dbInstance || defaultDb;
  assertMonthNotClosed(db, monthKey);

  const updatedCount = db.prepare(`
    UPDATE session_visitor_fees
    SET status = 'PAYMENT_REQUESTED', updated_at = CURRENT_TIMESTAMP
    WHERE member_id = ? AND status = 'UNPAID' AND session_id IN (
      SELECT id FROM playing_sessions WHERE month_key = ? AND status != 'CANCELLED'
    )
  `).run(memberId, monthKey).changes;

  return {
    memberId,
    monthKey,
    updatedCount
  };
}

/**
 * Admin clicks "Xác nhận đã nhận tiền" (Admin Confirmation):
 * Transitions PAYMENT_REQUESTED and UNPAID visitor fees for member in monthKey to PAID.
 * Creates ONE income_transaction (Category: VISITOR_FEE, Type: VÃNG LAI) for total aggregated amount.
 * Is IDEMPOTENT.
 */
export function confirmVisitorPaymentByAdmin(
  dbInstance: DatabaseType | undefined,
  memberId: string,
  monthKey: string,
  paymentMethod: 'CASH' | 'BANK_TRANSFER' = 'BANK_TRANSFER',
  notes?: string,
  userId?: string
) {
  const db = dbInstance || defaultDb;
  assertMonthNotClosed(db, monthKey);

  const member = db.prepare('SELECT full_name FROM members WHERE id = ?').get(memberId) as any;
  if (!member) {
    throw new Error('Thành viên không tồn tại.');
  }
  const memberName = member.full_name;

  const targetFees = db.prepare(`
    SELECT svf.id, svf.amount, svf.status, svf.session_id
    FROM session_visitor_fees svf
    JOIN playing_sessions ps ON svf.session_id = ps.id
    WHERE svf.member_id = ? AND ps.month_key = ? AND ps.status != 'CANCELLED' AND svf.status IN ('UNPAID', 'PAYMENT_REQUESTED')
  `).all(memberId, monthKey) as { id: string; amount: number; status: string; session_id: string }[];

  if (targetFees.length === 0) {
    // Already paid or no visitor fees due
    return {
      memberId,
      monthKey,
      paidCount: 0,
      totalAmount: 0,
      message: 'Không có khoản phí vãng lai nào cần xác nhận hoặc đã thanh toán xong.'
    };
  }

  const totalAmount = targetFees.reduce((sum, f) => sum + f.amount, 0);

  const runAtomic = db.transaction(() => {
    const incTxId = 'inc_v_' + Math.random().toString(36).substring(2, 10);
    const todayStr = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO income_transactions (
        id, transaction_date, month_key, category, description, member_id,
        original_amount, rounded_amount, payment_method, is_void, created_by
      ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, ?, 0, ?)
    `).run(
      incTxId,
      todayStr,
      monthKey,
      `Phí vãng lai tháng ${monthKey} - ${memberName}`,
      memberId,
      totalAmount,
      totalAmount,
      paymentMethod,
      userId || null
    );

    const feeIds = targetFees.map(f => f.id);
    const placeholders = feeIds.map(() => '?').join(',');

    db.prepare(`
      UPDATE session_visitor_fees
      SET status = 'PAID', income_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(incTxId, ...feeIds);

    return {
      memberId,
      monthKey,
      paidCount: targetFees.length,
      totalAmount,
      incomeTransactionId: incTxId,
      status: 'PAID'
    };
  });

  return runAtomic();
}

