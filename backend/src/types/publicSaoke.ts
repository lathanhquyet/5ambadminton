import { MonthlyDashboardReport } from '../services/reportService';

export interface PublicFinancialSummary {
  month: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
}

export interface PublicIncomeCategory {
  amount: number;
  percentage: number;
}

export interface PublicIncomeBreakdown {
  FIXED_FUND: PublicIncomeCategory;
  VISITOR_FEE: PublicIncomeCategory;
  OTHER_INCOME: PublicIncomeCategory;
}

export interface PublicExpenseCategory {
  amount: number;
  percentage: number;
}

export interface PublicExpenseBreakdown {
  COURT_FEE: PublicExpenseCategory;
  SHUTTLE_PURCHASE: PublicExpenseCategory;
  OTHER_EXPENSE: PublicExpenseCategory;
}

export interface PublicVisitorFeeSummary {
  due: number;
  collected: number;
  outstanding: number;
  cashIncome: number;
}

export interface PublicActivitySummary {
  sessions: number;
  totalPlayers: number;
  shuttleUsed: number;
  currentInventory: number;
}

export interface PublicSaokeMonthlyReport {
  month: string;
  financial: PublicFinancialSummary;
  incomeBreakdown: PublicIncomeBreakdown;
  expenseBreakdown: PublicExpenseBreakdown;
  visitorFee: PublicVisitorFeeSummary;
  activity: PublicActivitySummary;
}

/**
 * Maps MonthlyDashboardReport to explicit ALLOW-LIST Public DTO.
 * Guarantees that internal database IDs, passwords, tokens, audit logs, or PII are never leaked.
 */
export function toPublicSaokeDTO(report: MonthlyDashboardReport): PublicSaokeMonthlyReport {
  return {
    month: report.month,
    financial: {
      month: report.financial.month,
      openingBalance: report.financial.openingBalance,
      totalIncome: report.financial.totalIncome,
      totalExpense: report.financial.totalExpense,
      endingBalance: report.financial.endingBalance
    },
    incomeBreakdown: {
      FIXED_FUND: {
        amount: report.incomeBreakdown.FIXED_FUND.amount,
        percentage: report.incomeBreakdown.FIXED_FUND.percentage
      },
      VISITOR_FEE: {
        amount: report.incomeBreakdown.VISITOR_FEE.amount,
        percentage: report.incomeBreakdown.VISITOR_FEE.percentage
      },
      OTHER_INCOME: {
        amount: report.incomeBreakdown.OTHER_INCOME.amount,
        percentage: report.incomeBreakdown.OTHER_INCOME.percentage
      }
    },
    expenseBreakdown: {
      COURT_FEE: {
        amount: report.expenseBreakdown.COURT_FEE.amount,
        percentage: report.expenseBreakdown.COURT_FEE.percentage
      },
      SHUTTLE_PURCHASE: {
        amount: report.expenseBreakdown.SHUTTLE_PURCHASE.amount,
        percentage: report.expenseBreakdown.SHUTTLE_PURCHASE.percentage
      },
      OTHER_EXPENSE: {
        amount: report.expenseBreakdown.OTHER_EXPENSE.amount,
        percentage: report.expenseBreakdown.OTHER_EXPENSE.percentage
      }
    },
    visitorFee: {
      due: report.visitorFee.due,
      collected: report.visitorFee.collected,
      outstanding: report.visitorFee.outstanding,
      cashIncome: report.visitorFee.cashIncome
    },
    activity: {
      sessions: report.activity.sessions,
      totalPlayers: report.activity.totalPlayers,
      shuttleUsed: report.activity.shuttleUsed,
      currentInventory: report.activity.currentInventory
    }
  };
}
