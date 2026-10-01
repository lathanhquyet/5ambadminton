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

export interface PublicDebtorDTO {
  memberId: string;
  memberName: string;
  memberType: 'FIXED' | 'VISITOR';
  daysPerWeek: number;
  month: string;
  totalFeeRequired: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'PAYMENT_REQUESTED';
  paymentReference: string;
}
