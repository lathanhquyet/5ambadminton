import axios from 'axios';
import { PublicSaokeMonthlyReport, PublicDebtorDTO } from '../types/publicSaoke';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Public API client strictly without JWT or authorization headers
export const publicApiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPublicSaokeMonthlyReport = async (monthKey: string): Promise<PublicSaokeMonthlyReport> => {
  const res = await publicApiClient.get<{ success: boolean; data: PublicSaokeMonthlyReport }>(
    `/public/saoke/monthly?month=${monthKey}`
  );
  return res.data.data;
};

export const getPublicSaokeDebtors = async (monthKey: string): Promise<PublicDebtorDTO[]> => {
  const res = await publicApiClient.get<{ success: boolean; data: PublicDebtorDTO[] }>(
    `/public/saoke/debtors?month=${monthKey}`
  );
  return res.data.data;
};

export const getPublicFundPaymentsReport = async (params: { month?: string; year?: string }) => {
  const query = new URLSearchParams(params as any).toString();
  const res = await publicApiClient.get<{ success: boolean; data: any }>(
    `/public/saoke/reports/fund-payments?${query}`
  );
  return res.data.data;
};

export const getPublicExpensesReport = async (params: { month?: string; year?: string }) => {
  const query = new URLSearchParams(params as any).toString();
  const res = await publicApiClient.get<{ success: boolean; data: any }>(
    `/public/saoke/reports/expenses?${query}`
  );
  return res.data.data;
};

export const getPublicAttendanceReport = async (params: { month?: string; year?: string }) => {
  const query = new URLSearchParams(params as any).toString();
  const res = await publicApiClient.get<{ success: boolean; data: any }>(
    `/public/saoke/reports/attendance?${query}`
  );
  return res.data.data;
};

export const getPublicShuttleUsageReport = async (params: { period_type: string; month?: string; year?: string }) => {
  const query = new URLSearchParams(params as any).toString();
  const res = await publicApiClient.get<{ success: boolean; data: any }>(
    `/public/saoke/reports/shuttle-usage?${query}`
  );
  return res.data.data;
};
