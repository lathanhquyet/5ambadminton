import { apiClient } from './client';
import { MonthlyDashboardReport } from '../types/report';

export async function getMonthlyReport(monthKey: string): Promise<MonthlyDashboardReport> {
  const res = await apiClient.get('/reports/monthly', {
    params: { month: monthKey }
  });
  return res.data.data;
}
