export interface MonthlyFinancialReport {
  month: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  outstandingDebt?: number;
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
