import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { calculateExpectedDays, roundupToThousand, roundupToTenThousand } from './businessFormula';

export interface FeeCalculationParams {
  monthKey: string; // 'YYYY-MM'
  calculationMethod?: 'EQUAL_SPLIT' | 'BY_REGISTERED_DAYS' | 'MANUAL';
  totalCostToAllocate?: number;
  manualMemberAmounts?: Record<string, number>;
  userId?: string;
}

export interface PaymentRecordParams {
  memberId: string;
  monthKey: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  bankTxCode?: string;
  notes?: string;
  userId?: string;
}

/**
 * Checks if a monthly period is CLOSED. Throws error if CLOSED.
 */
export function assertMonthNotClosed(db: DatabaseType, monthKey: string): void {
  const closing = db.prepare('SELECT status FROM monthly_closings WHERE month_key = ?').get(monthKey) as { status: string } | undefined;
  if (closing && closing.status === 'CLOSED') {
    throw new Error(`Không thể thay đổi dữ liệu tài chính của tháng ${monthKey} đã CHỐT (CLOSED).`);
  }
}

/**
 * FeeEngine: Calculates Fixed Fund fees for all fixed members for a given month.
 */
export function calculateMonthlyFixedFees(
  dbInstance: DatabaseType | undefined,
  params: FeeCalculationParams
): { count: number; totalAllocated: number } {
  const db = dbInstance || defaultDb;
  const { monthKey, calculationMethod = 'EQUAL_SPLIT', totalCostToAllocate = 0, manualMemberAmounts = {}, userId } = params;

  assertMonthNotClosed(db, monthKey);

  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Fetch active fixed members
  const fixedMembers = db
    .prepare("SELECT * FROM members WHERE member_type = 'FIXED' AND status = 'ACTIVE'")
    .all() as any[];

  if (fixedMembers.length === 0) {
    return { count: 0, totalAllocated: 0 };
  }

  // 1. Create/Update Snapshots for expected days
  const memberExpectedDaysMap: Record<string, number> = {};
  let totalCalculatedDaysSum = 0;

  const daysInMonth = new Date(year, month, 0).getDate();

  fixedMembers.forEach((member) => {
    const expectedDays = calculateExpectedDays(member.days_per_week, year, month);
    memberExpectedDaysMap[member.id] = expectedDays;
    totalCalculatedDaysSum += expectedDays;

    const formulaStr = `ROUNDUP(${member.days_per_week} * ${daysInMonth} / 7, 0) = ${expectedDays}`;
    const snapId = 'snap_' + monthKey.replace('-', '') + '_' + member.id;

    db.prepare(`
      INSERT INTO member_month_snapshots (
        id, month_key, member_id, days_per_week, days_in_month, calculated_days, calculation_formula
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(month_key, member_id) DO UPDATE SET
        days_per_week = excluded.days_per_week,
        days_in_month = excluded.days_in_month,
        calculated_days = excluded.calculated_days,
        calculation_formula = excluded.calculation_formula
    `).run(snapId, monthKey, member.id, member.days_per_week, daysInMonth, expectedDays, formulaStr);
  });

  // 2. Fetch or create fee_config version for month
  const feeConfigId = 'cfg_fixed_' + monthKey;
  const existingConfig = db.prepare('SELECT id FROM fee_configs WHERE id = ?').get(feeConfigId);
  if (!existingConfig) {
    db.prepare(`
      INSERT INTO fee_configs (id, fee_type, name, calculation_method, effective_from, version, default_amount, created_by)
      VALUES (?, 'FIXED_FUND', ?, ?, ?, 1, ?, ?)
    `).run(feeConfigId, `Cấu hình Phí cố định tháng ${monthKey}`, calculationMethod, `${monthKey}-01`, totalCostToAllocate, userId || null);
  }

  // 3. Compute per-member fee
  let totalAllocated = 0;

  fixedMembers.forEach((member) => {
    let originalAmount = 0;

    if (calculationMethod === 'EQUAL_SPLIT') {
      originalAmount = totalCostToAllocate / fixedMembers.length;
    } else if (calculationMethod === 'BY_REGISTERED_DAYS') {
      if (totalCalculatedDaysSum > 0) {
        originalAmount = (totalCostToAllocate / totalCalculatedDaysSum) * memberExpectedDaysMap[member.id];
      }
    } else if (calculationMethod === 'MANUAL') {
      originalAmount = manualMemberAmounts[member.id] || 0;
    }

    const roundedAmount = roundupToTenThousand(originalAmount);
    totalAllocated += roundedAmount;

    // Check if member_fee record already exists for this month & member
    const existingFee = db
      .prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'FIXED_FUND'")
      .get(monthKey, member.id) as any;

    if (existingFee) {
      const paidAmount = existingFee.paid_amount || 0;
      const remainingAmount = Math.max(0, roundedAmount - paidAmount);
      let feeStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
      if (paidAmount >= roundedAmount) {
        feeStatus = 'PAID';
      } else if (paidAmount > 0) {
        feeStatus = 'PARTIAL';
      }

      db.prepare(`
        UPDATE member_fees
        SET original_amount = ?, rounded_amount = ?, remaining_amount = ?, fee_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(originalAmount, roundedAmount, remainingAmount, feeStatus, existingFee.id);
    } else {
      const feeId = 'fee_' + monthKey.replace('-', '') + '_' + member.id;
      db.prepare(`
        INSERT INTO member_fees (
          id, month_key, member_id, fee_config_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status
        ) VALUES (?, ?, ?, ?, 'FIXED_FUND', ?, ?, 0, ?, 'UNPAID')
      `).run(feeId, monthKey, member.id, feeConfigId, originalAmount, roundedAmount, roundedAmount);
    }
  });

  return { count: fixedMembers.length, totalAllocated };
}

/**
 * FeeEngine: Calculates Visitor fees based on actual session attendance.
 */
export function calculateVisitorFees(
  dbInstance: DatabaseType | undefined,
  monthKey: string,
  pricePerSession: number = 70000
): { count: number; totalAllocated: number } {
  const db = dbInstance || defaultDb;
  assertMonthNotClosed(db, monthKey);

  // Fetch visitor members or members who attended as visitor
  const visitorMembers = db
    .prepare("SELECT * FROM members WHERE member_type = 'VISITOR' AND status = 'ACTIVE'")
    .all() as any[];

  let totalAllocated = 0;
  let count = 0;

  visitorMembers.forEach((member) => {
    // Count actual PRESENT sessions in this monthKey
    const attendanceCountResult = db
      .prepare(`
        SELECT COUNT(psm.id) AS cnt
        FROM playing_session_members psm
        JOIN playing_sessions ps ON psm.session_id = ps.id
        WHERE psm.member_id = ? AND ps.month_key = ? AND psm.attendance_status = 'PRESENT' AND ps.status != 'CANCELLED'
      `)
      .get(member.id, monthKey) as { cnt: number };

    const actualSessions = attendanceCountResult ? attendanceCountResult.cnt : 0;
    if (actualSessions > 0) {
      count++;
      const originalAmount = actualSessions * pricePerSession;
      const roundedAmount = roundupToThousand(originalAmount);
      totalAllocated += roundedAmount;

      const existingFee = db
        .prepare("SELECT * FROM member_fees WHERE month_key = ? AND member_id = ? AND fee_type = 'VISITOR_FEE'")
        .get(monthKey, member.id) as any;

      if (existingFee) {
        const paidAmount = existingFee.paid_amount || 0;
        const remainingAmount = Math.max(0, roundedAmount - paidAmount);
        let feeStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
        if (paidAmount >= roundedAmount) {
          feeStatus = 'PAID';
        } else if (paidAmount > 0) {
          feeStatus = 'PARTIAL';
        }

        db.prepare(`
          UPDATE member_fees
          SET original_amount = ?, rounded_amount = ?, remaining_amount = ?, fee_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(originalAmount, roundedAmount, remainingAmount, feeStatus, existingFee.id);
      } else {
        const feeId = 'fee_vis_' + monthKey.replace('-', '') + '_' + member.id;
        db.prepare(`
          INSERT INTO member_fees (
            id, month_key, member_id, fee_type, original_amount, rounded_amount, paid_amount, remaining_amount, fee_status
          ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, 0, ?, 'UNPAID')
        `).run(feeId, monthKey, member.id, originalAmount, roundedAmount, roundedAmount);
      }
    }
  });

  return { count, totalAllocated };
}

/**
 * Gets debt list for all members in a given month.
 */
export function getMemberDebts(dbInstance: DatabaseType | undefined, monthKey: string) {
  const db = dbInstance || defaultDb;

  const members = db.prepare('SELECT id, full_name, member_type, days_per_week FROM members WHERE status != \'INACTIVE\'').all() as any[];

  return members.map((member) => {
    const fees = db
      .prepare('SELECT * FROM member_fees WHERE month_key = ? AND member_id = ?')
      .all(monthKey, member.id) as any[];

    let totalRequired = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    fees.forEach((f) => {
      totalRequired += f.rounded_amount;
      totalPaid += f.paid_amount;
      totalRemaining += f.remaining_amount;
    });

    // Also aggregate session_visitor_fees for this member in this month
    const visitorFeeRows = db
      .prepare(`
        SELECT svf.amount, svf.status, svf.income_transaction_id
        FROM session_visitor_fees svf
        JOIN playing_sessions ps ON svf.session_id = ps.id
        WHERE ps.month_key = ? AND svf.member_id = ? AND ps.status != 'CANCELLED'
      `)
      .all(monthKey, member.id) as { amount: number; status: string; income_transaction_id?: string }[];

    let hasRequested = false;
    visitorFeeRows.forEach((vf) => {
      totalRequired += vf.amount;
      if (vf.status === 'PAID' || vf.income_transaction_id) {
        totalPaid += vf.amount;
      } else {
        totalRemaining += vf.amount;
        if (vf.status === 'PAYMENT_REQUESTED') {
          hasRequested = true;
        }
      }
    });

    let status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'PAYMENT_REQUESTED' = 'UNPAID';
    if (totalRequired > 0 && totalPaid >= totalRequired) {
      status = 'PAID';
    } else if (hasRequested && totalRemaining > 0) {
      status = 'PAYMENT_REQUESTED';
    } else if (totalPaid > 0) {
      status = 'PARTIAL';
    }

    return {
      member_id: member.id,
      member_name: member.full_name,
      member_type: member.member_type,
      days_per_week: member.days_per_week,
      total_fee_required: totalRequired,
      paid_amount: totalPaid,
      remaining_amount: totalRemaining,
      status,
      payment_requested: hasRequested,
      fees_breakdown: fees
    };
  });
}

/**
 * Payment & Debt Engine: Records a member payment.
 * Validates amount <= total remaining debt. Throws PAYMENT_EXCEEDS_DEBT if amount > debt.
 */
export function recordMemberPayment(
  dbInstance: DatabaseType | undefined,
  params: PaymentRecordParams
): { paymentId: string; amountPaid: number; remainingDebtAfter: number } {
  const db = dbInstance || defaultDb;
  const { memberId, monthKey, paymentDate, amount, paymentMethod = 'BANK_TRANSFER', bankTxCode, notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (amount <= 0) {
    throw new Error('Số tiền nộp phải lớn hơn 0.');
  }

  // Duplicate payment check for bank_tx_code
  if (bankTxCode) {
    const existingPayment = db.prepare('SELECT id FROM payments WHERE bank_tx_code = ?').get(bankTxCode);
    if (existingPayment) {
      const err: any = new Error(`Mã giao dịch '${bankTxCode}' đã tồn tại trong hệ thống. Không thể nộp lặp.`);
      err.code = 'DUPLICATE_PAYMENT';
      throw err;
    }
  }

  // Fetch member fees with remaining_amount > 0
  const memberFees = db
    .prepare(`
      SELECT * FROM member_fees
      WHERE month_key = ? AND member_id = ? AND remaining_amount > 0
      ORDER BY created_at ASC
    `)
    .all(monthKey, memberId) as any[];

  // Fetch session visitor fees with status != 'PAID'
  const visitorFees = db
    .prepare(`
      SELECT svf.*, ps.session_date
      FROM session_visitor_fees svf
      JOIN playing_sessions ps ON svf.session_id = ps.id
      WHERE ps.month_key = ? AND svf.member_id = ? AND ps.status != 'CANCELLED' AND svf.status != 'PAID'
      ORDER BY ps.session_date ASC
    `)
    .all(monthKey, memberId) as any[];

  const fixedDebt = memberFees.reduce((sum, f) => sum + f.remaining_amount, 0);
  const visitorDebt = visitorFees.reduce((sum, vf) => sum + vf.amount, 0);
  const totalRemainingDebt = fixedDebt + visitorDebt;

  // VALIDATION: NO OVERPAID ALLOWED
  if (amount > totalRemainingDebt) {
    const err: any = new Error(
      `Số tiền đóng (${amount.toLocaleString()}đ) lớn hơn tổng công nợ còn thiếu (${totalRemainingDebt.toLocaleString()}đ). Hệ thống không hỗ trợ nộp dư.`
    );
    err.code = 'PAYMENT_EXCEEDS_DEBT';
    throw err;
  }

  const roundedAmount = roundupToThousand(amount);
  const paymentId = 'pay_' + Math.random().toString(36).substring(2, 10);

  const memberInfo = db.prepare('SELECT full_name FROM members WHERE id = ?').get(memberId) as { full_name?: string };
  const memberName = memberInfo?.full_name || 'Thành viên';

  db.transaction(() => {
    // Record Payment
    db.prepare(`
      INSERT INTO payments (
        id, payment_date, month_key, member_id, original_amount, rounded_amount, payment_method, bank_tx_code, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      paymentDate,
      monthKey,
      memberId,
      amount,
      roundedAmount,
      paymentMethod,
      bankTxCode || null,
      notes || null,
      userId || null
    );

    let unallocatedAmount = amount;

    // 1. Allocate across member_fees first
    for (const fee of memberFees) {
      if (unallocatedAmount <= 0) break;

      const allocation = Math.min(unallocatedAmount, fee.remaining_amount);
      const newPaid = fee.paid_amount + allocation;
      const newRemaining = fee.remaining_amount - allocation;

      let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
      if (newRemaining === 0) {
        newStatus = 'PAID';
      } else if (newPaid > 0) {
        newStatus = 'PARTIAL';
      }

      // Insert allocation
      const allocId = 'alloc_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO payment_allocations (id, payment_id, member_fee_id, allocated_amount)
        VALUES (?, ?, ?, ?)
      `).run(allocId, paymentId, fee.id, allocation);

      // Update member_fee
      db.prepare(`
        UPDATE member_fees
        SET paid_amount = ?, remaining_amount = ?, fee_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaid, newRemaining, newStatus, fee.id);

      // Record Income Transaction for member_fee
      const category = fee.fee_type === 'FIXED_FUND' ? 'FIXED_FUND' : fee.fee_type === 'VISITOR_FEE' ? 'VISITOR_FEE' : 'OTHER_INCOME';
      const incId = 'inc_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO income_transactions (
          id, transaction_date, month_key, category, description, member_id, original_amount, rounded_amount, payment_method, payment_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        incId,
        paymentDate,
        monthKey,
        category,
        `Thu phí thành viên ${fee.fee_type} tháng ${monthKey} - ${memberName}`,
        memberId,
        allocation,
        roundupToThousand(allocation),
        paymentMethod,
        paymentId,
        userId || null
      );

      unallocatedAmount -= allocation;
    }

    // 2. Allocate remaining amount across session_visitor_fees
    for (const vf of visitorFees) {
      if (unallocatedAmount <= 0) break;

      const allocation = Math.min(unallocatedAmount, vf.amount);

      if (allocation >= vf.amount) {
        const incId = 'inc_v_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO income_transactions (
            id, transaction_date, month_key, category, description, member_id, original_amount, rounded_amount, payment_method, payment_id, is_void, created_by
          ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
          incId,
          paymentDate,
          monthKey,
          `Phí vãng lai tháng ${monthKey} - ${memberName}`,
          memberId,
          allocation,
          allocation,
          paymentMethod,
          paymentId,
          userId || null
        );

        db.prepare(`
          UPDATE session_visitor_fees
          SET status = 'PAID', income_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(incId, vf.id);
      }

      unallocatedAmount -= allocation;
    }
  })();

  const remainingDebtAfter = totalRemainingDebt - amount;

  return {
    paymentId,
    amountPaid: amount,
    remainingDebtAfter
  };
}

/**
 * VietQR Integration: Generates VietQR url & payload for member's remaining debt.
 * QR Amount MUST equal remaining debt EXACT.
 */
export function generateVietQRData(
  dbInstance: DatabaseType | undefined,
  memberId: string,
  monthKey: string
): {
  bank_name: string;
  account_number: string;
  account_holder: string;
  amount: number;
  description: string;
  vietqr_url: string;
} {
  const db = dbInstance || defaultDb;

  const member = db.prepare('SELECT full_name FROM members WHERE id = ?').get(memberId) as { full_name: string } | undefined;
  if (!member) {
    throw new Error('Thành viên không tồn tại.');
  }

  // Get active bank account
  const bankAcc = db.prepare("SELECT * FROM bank_accounts WHERE is_active = 1 LIMIT 1").get() as any;
  const bankName = bankAcc ? bankAcc.bank_name : 'MB';
  const accNumber = bankAcc ? bankAcc.account_number : '090123456789';
  const accHolder = bankAcc ? bankAcc.account_holder : 'QUY CAU LONG 5AM';

  // Calculate remaining debt
  const fees = db
    .prepare('SELECT remaining_amount FROM member_fees WHERE month_key = ? AND member_id = ?')
    .all(monthKey, memberId) as { remaining_amount: number }[];

  const remainingDebt = fees.reduce((sum, f) => sum + f.remaining_amount, 0);

  if (remainingDebt <= 0) {
    throw new Error(`Thành viên ${member.full_name} không còn công nợ trong tháng ${monthKey}.`);
  }

  const description = `${member.full_name} - ${monthKey}`;
  const encodedInfo = encodeURIComponent(description);
  const vietqrUrl = `https://img.vietqr.io/image/${bankName}-${accNumber}-compact.png?amount=${remainingDebt}&addInfo=${encodedInfo}`;

  return {
    bank_name: bankName,
    account_number: accNumber,
    account_holder: accHolder,
    amount: remainingDebt,
    description,
    vietqr_url: vietqrUrl
  };
}
