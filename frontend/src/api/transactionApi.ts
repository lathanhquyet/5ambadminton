import { apiClient } from './client';

export interface VisitorFeeIncomePayload {
  transaction_date: string;
  month_key: string;
  payer_name?: string;
  amount: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
}

export interface OtherIncomePayload {
  transaction_date: string;
  month_key: string;
  description: string;
  source?: string;
  amount: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
}

export interface CourtFeePayload {
  transaction_date?: string;
  month_key: string;
  price_per_day?: number;
  total_days?: number;
  total_courts?: number;
  description?: string;
  recipient?: string;
  amount?: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
}

export interface ShuttlePurchasePayload {
  purchase_date: string;
  month_key: string;
  product_id?: string;
  supplier: string;
  tubes_qty: number;
  price_per_tube: number;
  notes?: string;
}

export interface OtherExpensePayload {
  transaction_date: string;
  month_key: string;
  description: string;
  recipient?: string;
  amount: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
}

export interface TransactionHistoryItem {
  id: string;
  date: string;
  monthKey: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  categoryLabel: string;
  description: string;
  payerOrRecipient: string;
  incomeAmount: number;
  expenseAmount: number;
  paymentMethod: string;
  reference: string;
  createdBy: string;
  createdAt: string;
}

export interface TransactionHistoryResponse {
  items: TransactionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
  };
}

// Income Vouchers
export const createVisitorFeeIncome = async (payload: VisitorFeeIncomePayload) => {
  const res = await apiClient.post('/transactions/visitor-fee', payload);
  return res.data;
};

export const createOtherIncome = async (payload: OtherIncomePayload) => {
  const res = await apiClient.post('/transactions/other-income', payload);
  return res.data;
};

// Expense Vouchers
export const createCourtFeeExpense = async (payload: CourtFeePayload) => {
  const res = await apiClient.post('/transactions/court-fee', payload);
  return res.data;
};

export const createShuttlePurchaseExpense = async (payload: ShuttlePurchasePayload) => {
  const res = await apiClient.post('/transactions/shuttle-purchase', payload);
  return res.data;
};

export const createOtherExpense = async (payload: OtherExpensePayload) => {
  const res = await apiClient.post('/transactions/other-expense', payload);
  return res.data;
};

// Transaction History
export const getTransactionHistory = async (params: {
  month?: string;
  type?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<TransactionHistoryResponse> => {
  const query = new URLSearchParams();
  if (params.month) query.append('month', params.month);
  if (params.type && params.type !== 'ALL') query.append('type', params.type);
  if (params.category && params.category !== 'ALL') query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());

  const res = await apiClient.get<{ success: boolean; data: TransactionHistoryResponse }>(
    `/transactions/history?${query.toString()}`
  );
  return res.data.data;
};
