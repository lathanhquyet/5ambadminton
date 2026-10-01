import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { getCashLedgerSummary } from './cashLedgerService';
import { getCurrentStockInPieces } from './inventoryService';

export interface MonthlyFinancialReport {
  month: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  outstandingDebt: number;
}

export interface IncomeCategoryBreakdown {
  amount: number;
  percentage: number;
}

export interface IncomeBreakdownReport {
  FIXED_FUND: IncomeCategoryBreakdown;
  VISITOR_FEE: IncomeCategoryBreakdown;
  OTHER_INCOME: IncomeCategoryBreakdown;
}

export interface ExpenseCategoryBreakdown {
  amount: number;
  percentage: number;
}

export interface ExpenseBreakdownReport {
  COURT_FEE: ExpenseCategoryBreakdown;
  SHUTTLE_PURCHASE: ExpenseCategoryBreakdown;
  OTHER_EXPENSE: ExpenseCategoryBreakdown;
}

export interface VisitorFeeReport {
  due: number;
  collected: number;
  outstanding: number;
  cashIncome: number;
}

export interface ActivityReport {
  sessions: number;
  totalPlayers: number;
  shuttleUsed: number;
  currentInventory: number;
}

export interface MonthlyDashboardReport {
  month: string;
  financial: MonthlyFinancialReport;
  incomeBreakdown: IncomeBreakdownReport;
  expenseBreakdown: ExpenseBreakdownReport;
  visitorFee: VisitorFeeReport;
  activity: ActivityReport;
}

// Interfaces for Task 6.9 Reports
export interface FundPaymentReportItem {
  member_id: string;
  full_name: string;
  member_type: 'FIXED' | 'VISITOR';
  paid_amount: number;
  payment_count: number;
}

export interface FundPaymentReportResult {
  month?: string;
  year?: string;
  summary: {
    total_collected: number;
    member_count: number;
  };
  items: FundPaymentReportItem[];
}

export interface ExpenseReportItem {
  category: string;
  category_name: string;
  total_amount: number;
  transaction_count: number;
}

export interface ExpenseReportResult {
  month?: string;
  year?: string;
  summary: {
    total_expense: number;
  };
  items: ExpenseReportItem[];
}

export interface AttendanceReportItem {
  member_id: string;
  full_name: string;
  member_type: 'FIXED' | 'VISITOR';
  session_count: number;
}

export interface AttendanceReportResult {
  month?: string;
  year?: string;
  summary: {
    total_player_sessions: number;
    total_unique_members: number;
  };
  items: AttendanceReportItem[];
}

export interface ShuttleUsageReportItem {
  period_label: string;
  shuttle_pieces: number;
  shuttle_tubes: number;
  shuttle_remaining_pieces: number;
  formatted_display: string;
}

export interface ShuttleUsageReportResult {
  period_type: 'DAILY' | 'MONTHLY' | 'YEARLY';
  month?: string;
  year?: string;
  summary: {
    total_shuttle_pieces: number;
    total_shuttle_tubes: number;
    formatted_total_display: string;
  };
  items: ShuttleUsageReportItem[];
}

/**
 * Validates canonical YYYY-MM month key format strictly.
 */
export function isValidMonthKey(monthKey: any): boolean {
  if (typeof monthKey !== 'string') return false;
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return monthRegex.test(monthKey);
}

/**
 * Validates 4-digit YYYY year format strictly.
 */
export function isValidYear(year: any): boolean {
  if (typeof year !== 'string') return false;
  return /^\d{4}$/.test(year);
}

/**
 * Generates the centralized, read-only Monthly Dashboard Report.
 */
export function getMonthlyDashboardReport(
  dbInstance: DatabaseType | undefined,
  monthKey: string
): MonthlyDashboardReport {
  const db = dbInstance || defaultDb;

  if (!isValidMonthKey(monthKey)) {
    throw new Error('Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12).');
  }

  // 1. Financial Ledger Summary
  const ledgerSummary = getCashLedgerSummary(db, monthKey);

  const memberDebtRes = db
    .prepare('SELECT COALESCE(SUM(remaining_amount), 0) AS total FROM member_fees WHERE month_key = ?')
    .get(monthKey) as { total: number };
  const outstandingDebt = memberDebtRes ? memberDebtRes.total : 0;

  const financial: MonthlyFinancialReport = {
    month: monthKey,
    openingBalance: ledgerSummary.opening_balance,
    totalIncome: ledgerSummary.total_income,
    totalExpense: ledgerSummary.total_expense,
    endingBalance: ledgerSummary.ending_balance,
    outstandingDebt
  };

  // 2. Income Breakdown & Percentages
  const totalInc = ledgerSummary.total_income;
  const incFixed = ledgerSummary.income_breakdown.fixed_fund;
  const incVisitor = ledgerSummary.income_breakdown.visitor_fee;
  const incOther = ledgerSummary.income_breakdown.other_income;

  const incomeBreakdown: IncomeBreakdownReport = {
    FIXED_FUND: {
      amount: incFixed,
      percentage: totalInc > 0 ? Number(((incFixed / totalInc) * 100).toFixed(2)) : 0
    },
    VISITOR_FEE: {
      amount: incVisitor,
      percentage: totalInc > 0 ? Number(((incVisitor / totalInc) * 100).toFixed(2)) : 0
    },
    OTHER_INCOME: {
      amount: incOther,
      percentage: totalInc > 0 ? Number(((incOther / totalInc) * 100).toFixed(2)) : 0
    }
  };

  // 3. Expense Breakdown & Percentages
  const totalExp = ledgerSummary.total_expense;
  const expCourt = ledgerSummary.expense_breakdown.court_fee;
  const expShuttle = ledgerSummary.expense_breakdown.shuttle_purchase;
  const expOther = ledgerSummary.expense_breakdown.other_expense;

  const expenseBreakdown: ExpenseBreakdownReport = {
    COURT_FEE: {
      amount: expCourt,
      percentage: totalExp > 0 ? Number(((expCourt / totalExp) * 100).toFixed(2)) : 0
    },
    SHUTTLE_PURCHASE: {
      amount: expShuttle,
      percentage: totalExp > 0 ? Number(((expShuttle / totalExp) * 100).toFixed(2)) : 0
    },
    OTHER_EXPENSE: {
      amount: expOther,
      percentage: totalExp > 0 ? Number(((expOther / totalExp) * 100).toFixed(2)) : 0
    }
  };

  // 4. Visitor Fee Report
  const visitorFeeRows = db
    .prepare(`
      SELECT svf.amount, svf.status
      FROM session_visitor_fees svf
      JOIN playing_sessions ps ON svf.session_id = ps.id
      WHERE ps.month_key = ?
    `)
    .all(monthKey) as { amount: number; status: string }[];

  let due = 0;
  let collected = 0;

  visitorFeeRows.forEach((row) => {
    due += row.amount;
    if (row.status === 'PAID') {
      collected += row.amount;
    }
  });

  const visitorFeeCashIncome = ledgerSummary.income_breakdown.visitor_fee;

  const visitorFee: VisitorFeeReport = {
    due,
    collected,
    outstanding: due - collected,
    cashIncome: visitorFeeCashIncome
  };

  // 5. Activity Report
  const sessionsCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM playing_sessions WHERE month_key = ? AND status != 'CANCELLED'").get(monthKey) as any
  ).cnt;

  const totalPlayersCount = (
    db
      .prepare(`
        SELECT COUNT(psm.id) AS cnt
        FROM playing_session_members psm
        JOIN playing_sessions ps ON psm.session_id = ps.id
        WHERE ps.month_key = ? AND ps.status != 'CANCELLED' AND psm.attendance_status = 'PRESENT'
      `)
      .get(monthKey) as any
  ).cnt;

  const shuttleUsedPieces = Math.abs(
    (
      db
        .prepare(`
          SELECT COALESCE(SUM(quantity_in_pieces), 0) AS total
          FROM inventory_transactions
          WHERE month_key = ? AND transaction_type = 'USAGE'
        `)
        .get(monthKey) as any
    ).total
  );

  const currentInventoryPieces = getCurrentStockInPieces(db, 'prod_tc77');

  const activity: ActivityReport = {
    sessions: sessionsCount,
    totalPlayers: totalPlayersCount,
    shuttleUsed: shuttleUsedPieces,
    currentInventory: currentInventoryPieces
  };

  return {
    month: monthKey,
    financial,
    incomeBreakdown,
    expenseBreakdown,
    visitorFee,
    activity
  };
}

/**
 * Report #1 — Fund Payment Report (Danh Sách Đóng Quỹ)
 * Calculates total confirmed/paid funds per member for a given month or year.
 * Sorted DESC by paid_amount, full_name ASC.
 */
export function getFundPaymentReport(
  dbInstance: DatabaseType | undefined,
  params: { month?: string; year?: string }
): FundPaymentReportResult {
  const db = dbInstance || defaultDb;
  const { month, year } = params;

  let whereClause = 'it.is_void = 0 AND it.member_id IS NOT NULL';
  const queryParams: any[] = [];

  if (month && isValidMonthKey(month)) {
    whereClause += ' AND it.month_key = ?';
    queryParams.push(month);
  } else if (year && isValidYear(year)) {
    whereClause += ' AND it.month_key LIKE ?';
    queryParams.push(`${year}-%`);
  }

  const rows = db
    .prepare(`
      SELECT 
        m.id AS member_id,
        m.full_name,
        m.member_type,
        SUM(it.rounded_amount) AS paid_amount,
        COUNT(it.id) AS payment_count
      FROM income_transactions it
      JOIN members m ON it.member_id = m.id
      WHERE ${whereClause}
      GROUP BY m.id, m.full_name, m.member_type
      ORDER BY paid_amount DESC, m.full_name ASC
    `)
    .all(...queryParams) as FundPaymentReportItem[];

  const totalCollected = rows.reduce((acc, r) => acc + r.paid_amount, 0);

  return {
    month,
    year,
    summary: {
      total_collected: totalCollected,
      member_count: rows.length
    },
    items: rows
  };
}

/**
 * Report #2 — Expense Report (Danh Sách Khoản Chi)
 * Summarizes expenses by category (Phí sân, Phí cầu, Phí khác) for a given month or year.
 * Sorted DESC by total_amount.
 */
export function getExpenseReport(
  dbInstance: DatabaseType | undefined,
  params: { month?: string; year?: string }
): ExpenseReportResult {
  const db = dbInstance || defaultDb;
  const { month, year } = params;

  let whereClause = 'et.is_void = 0';
  const queryParams: any[] = [];

  if (month && isValidMonthKey(month)) {
    whereClause += ' AND et.month_key = ?';
    queryParams.push(month);
  } else if (year && isValidYear(year)) {
    whereClause += ' AND et.month_key LIKE ?';
    queryParams.push(`${year}-%`);
  }

  const categoryNames: Record<string, string> = {
    COURT_FEE: 'Phí sân',
    SHUTTLE_PURCHASE: 'Phí cầu',
    OTHER_EXPENSE: 'Phí khác'
  };

  const rows = db
    .prepare(`
      SELECT 
        et.category,
        SUM(et.rounded_amount) AS total_amount,
        COUNT(et.id) AS transaction_count
      FROM expense_transactions et
      WHERE ${whereClause}
      GROUP BY et.category
      ORDER BY total_amount DESC
    `)
    .all(...queryParams) as { category: string; total_amount: number; transaction_count: number }[];

  const items: ExpenseReportItem[] = rows.map((r) => ({
    category: r.category,
    category_name: categoryNames[r.category] || r.category,
    total_amount: r.total_amount,
    transaction_count: r.transaction_count
  }));

  const totalExpense = items.reduce((acc, r) => acc + r.total_amount, 0);

  return {
    month,
    year,
    summary: {
      total_expense: totalExpense
    },
    items
  };
}

/**
 * Report #3 — Member Attendance Report (Thống Kê Số Buổi Chơi Của Từng Thành Viên)
 * Calculates number of distinct sessions attended per member (Fixed & Visitor).
 * Max 1 count per member per session. Sorted DESC by session_count, full_name ASC.
 */
export function getAttendanceReport(
  dbInstance: DatabaseType | undefined,
  params: { month?: string; year?: string }
): AttendanceReportResult {
  const db = dbInstance || defaultDb;
  const { month, year } = params;

  let monthFilter = '';
  const queryParams: any[] = [];

  if (month && isValidMonthKey(month)) {
    monthFilter = 'ps.month_key = ?';
    queryParams.push(month, month);
  } else if (year && isValidYear(year)) {
    monthFilter = 'ps.month_key LIKE ?';
    queryParams.push(`${year}-%`, `${year}-%`);
  } else {
    monthFilter = '1=1';
  }

  const rows = db
    .prepare(`
      WITH member_session_pairs AS (
        SELECT psm.member_id, ps.id AS session_id
        FROM playing_session_members psm
        JOIN playing_sessions ps ON psm.session_id = ps.id
        WHERE psm.attendance_status = 'PRESENT' AND ps.status != 'CANCELLED' AND ${monthFilter}
        UNION
        SELECT svf.member_id, ps.id AS session_id
        FROM session_visitor_fees svf
        JOIN playing_sessions ps ON svf.session_id = ps.id
        WHERE ps.status != 'CANCELLED' AND ${monthFilter}
      )
      SELECT 
        m.id AS member_id,
        m.full_name,
        m.member_type,
        COUNT(msp.session_id) AS session_count
      FROM member_session_pairs msp
      JOIN members m ON msp.member_id = m.id
      GROUP BY m.id, m.full_name, m.member_type
      ORDER BY session_count DESC, m.full_name ASC
    `)
    .all(...queryParams) as AttendanceReportItem[];

  const totalPlayerSessions = rows.reduce((acc, r) => acc + r.session_count, 0);

  return {
    month,
    year,
    summary: {
      total_player_sessions: totalPlayerSessions,
      total_unique_members: rows.length
    },
    items: rows
  };
}

/**
 * Report #4 — Shuttle Usage Report (Thống Kê Số Quả Cầu Sử Dụng)
 * Summarizes actual shuttle usage pieces/tubes by Daily, Monthly, or Yearly breakdown.
 * Sorted DESC by shuttle_pieces.
 */
export function getShuttleUsageReport(
  dbInstance: DatabaseType | undefined,
  params: { periodType?: 'DAILY' | 'MONTHLY' | 'YEARLY'; month?: string; year?: string }
): ShuttleUsageReportResult {
  const db = dbInstance || defaultDb;
  const periodType = params.periodType || 'DAILY';
  const { month, year } = params;

  let query = '';
  const queryParams: any[] = [];

  if (periodType === 'DAILY') {
    let filter = "transaction_type = 'USAGE'";
    if (month && isValidMonthKey(month)) {
      filter += ' AND month_key = ?';
      queryParams.push(month);
    } else if (year && isValidYear(year)) {
      filter += ' AND month_key LIKE ?';
      queryParams.push(`${year}-%`);
    }

    query = `
      SELECT 
        transaction_date AS period_label,
        ABS(SUM(quantity_in_pieces)) AS shuttle_pieces
      FROM inventory_transactions
      WHERE ${filter}
      GROUP BY transaction_date
      ORDER BY shuttle_pieces DESC, transaction_date DESC
    `;
  } else if (periodType === 'MONTHLY') {
    let filter = "transaction_type = 'USAGE'";
    if (year && isValidYear(year)) {
      filter += ' AND month_key LIKE ?';
      queryParams.push(`${year}-%`);
    }

    query = `
      SELECT 
        month_key AS period_label,
        ABS(SUM(quantity_in_pieces)) AS shuttle_pieces
      FROM inventory_transactions
      WHERE ${filter}
      GROUP BY month_key
      ORDER BY shuttle_pieces DESC, month_key DESC
    `;
  } else {
    // YEARLY
    query = `
      SELECT 
        substr(transaction_date, 1, 4) AS period_label,
        ABS(SUM(quantity_in_pieces)) AS shuttle_pieces
      FROM inventory_transactions
      WHERE transaction_type = 'USAGE'
      GROUP BY period_label
      ORDER BY shuttle_pieces DESC, period_label DESC
    `;
  }

  const rawRows = db.prepare(query).all(...queryParams) as { period_label: string; shuttle_pieces: number }[];

  const items: ShuttleUsageReportItem[] = rawRows.map((r) => {
    const tubes = Math.floor(r.shuttle_pieces / 12);
    const rem = r.shuttle_pieces % 12;
    const formatted = rem > 0 ? `${tubes} ống ${rem} quả (${r.shuttle_pieces} quả)` : `${tubes} ống (${r.shuttle_pieces} quả)`;
    return {
      period_label: r.period_label,
      shuttle_pieces: r.shuttle_pieces,
      shuttle_tubes: tubes,
      shuttle_remaining_pieces: rem,
      formatted_display: formatted
    };
  });

  const totalPieces = items.reduce((acc, r) => acc + r.shuttle_pieces, 0);
  const totalTubes = Math.floor(totalPieces / 12);
  const totalRem = totalPieces % 12;
  const formattedTotal = totalRem > 0 ? `${totalTubes} ống ${totalRem} quả (${totalPieces} quả)` : `${totalTubes} ống (${totalPieces} quả)`;

  return {
    period_type: periodType,
    month,
    year,
    summary: {
      total_shuttle_pieces: totalPieces,
      total_shuttle_tubes: totalTubes,
      formatted_total_display: formattedTotal
    },
    items
  };
}
