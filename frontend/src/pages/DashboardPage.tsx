import React, { useState, useEffect } from 'react';
import { getMonthlyReport } from '../api/reportApi';
import { MonthlyDashboardReport } from '../types/report';
import { getCurrentMonthKey } from '../utils/dateUtils';
import { ReportMonthSelector } from '../components/dashboard/ReportMonthSelector';
import { FinancialSummarySection } from '../components/dashboard/FinancialSummarySection';
import { IncomeBreakdownSection } from '../components/dashboard/IncomeBreakdownSection';
import { ExpenseBreakdownSection } from '../components/dashboard/ExpenseBreakdownSection';
import { VisitorFeeSummarySection } from '../components/dashboard/VisitorFeeSummarySection';
import { ActivitySummarySection } from '../components/dashboard/ActivitySummarySection';
import { formatMonthDisplay } from '../utils/formatters';
import { RefreshCw, AlertCircle, LayoutDashboard } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [report, setReport] = useState<MonthlyDashboardReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (monthKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMonthlyReport(monthKey);
      setReport(data);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || `Không thể tải báo cáo ${formatMonthDisplay(monthKey)}.`;
      setError(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedMonth);
  }, [selectedMonth]);

  const handleMonthChange = (newMonth: string) => {
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const handleRetry = () => {
    fetchReport(selectedMonth);
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Báo Cáo Tổng Quan</h1>
            <p className="text-xs text-slate-400">
              Quản lý tài chính, thu chi, quỹ sân & tồn kho - {formatMonthDisplay(selectedMonth)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ReportMonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            disabled={loading}
          />
          <button
            onClick={handleRetry}
            disabled={loading}
            title="Tải lại báo cáo"
            className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-2xl transition disabled:opacity-50 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-56 bg-slate-900/60 border border-slate-800/60 rounded-2xl" />
            <div className="h-56 bg-slate-900/60 border border-slate-800/60 rounded-2xl" />
          </div>
          <div className="h-36 bg-slate-900/60 border border-slate-800/60 rounded-2xl" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-rose-950/20 border border-rose-800/60 p-6 rounded-2xl text-center space-y-4 my-8">
          <div className="inline-flex p-3 bg-rose-500/10 text-rose-400 rounded-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-300">Đã xảy ra lỗi</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm rounded-xl transition inline-flex items-center gap-2 shadow-md shadow-rose-950/50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Loaded Dashboard State */}
      {!loading && !error && report && (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <FinancialSummarySection financial={report.financial} />

          {/* Income & Expense Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IncomeBreakdownSection incomeBreakdown={report.incomeBreakdown} />
            <ExpenseBreakdownSection expenseBreakdown={report.expenseBreakdown} />
          </div>

          {/* Visitor Fee Summary Card */}
          <VisitorFeeSummarySection visitorFee={report.visitorFee} />

          {/* Activity & Inventory Summary Card */}
          <ActivitySummarySection activity={report.activity} />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
