import React, { useState, useEffect } from 'react';
import { PublicSaokeMonthlyReport } from '../types/publicSaoke';
import { getPublicSaokeMonthlyReport } from '../api/saokeApi';
import { getCurrentMonthKey } from '../utils/dateUtils';
import { PublicSaokeHeader } from '../components/saoke/PublicSaokeHeader';
import { PublicSaokeMonthSelector } from '../components/saoke/PublicSaokeMonthSelector';
import { PublicSaokeSummary } from '../components/saoke/PublicSaokeSummary';
import { PublicSaokeIncome } from '../components/saoke/PublicSaokeIncome';
import { PublicSaokeExpense } from '../components/saoke/PublicSaokeExpense';
import { PublicSaokeVisitorFee } from '../components/saoke/PublicSaokeVisitorFee';
import { PublicSaokeActivity } from '../components/saoke/PublicSaokeActivity';
import { PublicSaokeReportsSection } from '../components/saoke/PublicSaokeReportsSection';
import { PublicSaokePaymentSection } from '../components/saoke/PublicSaokePaymentSection';
import { AlertCircle, RefreshCw, Lock, Sparkles } from 'lucide-react';

export const PublicSaokePage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [report, setReport] = useState<PublicSaokeMonthlyReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (targetMonth: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicSaokeMonthlyReport(targetMonth);
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.error?.message ||
          'Không thể tải sao kê quỹ tháng. Vui lòng kiểm tra lại kết nối mạng và thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(month);
  }, [month]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <PublicSaokeHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Month Selector & Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>BÁO CÁO THU CHI THÁNG</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dữ liệu được cập nhật từ hệ thống quản lý Quỹ Cầu Lông 5AM (Read-Only)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PublicSaokeMonthSelector
              selectedMonth={month}
              onMonthChange={(newMonth) => setMonth(newMonth)}
              disabled={loading}
            />
            <button
              onClick={() => fetchReport(month)}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-900/80 border border-slate-800 rounded-2xl" />
              ))}
            </div>
            <div className="h-64 bg-slate-900/80 border border-slate-800 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-slate-900/80 border border-slate-800 rounded-2xl" />
              <div className="h-64 bg-slate-900/80 border border-slate-800 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl text-center space-y-4">
            <div className="inline-flex p-3 bg-rose-500/20 text-rose-400 rounded-full">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Không thể tải sao kê quỹ</h3>
              <p className="text-xs text-rose-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchReport(month)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-rose-950/40 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !report && (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-400">
            Tháng này chưa có dữ liệu sao kê.
          </div>
        )}

        {/* Loaded State - STRICT LAYOUT ORDER REQUIRED BY TASK 4 AUDIT */}
        {!loading && !error && report && (
          <div className="space-y-6">
            {/* 1. Four Financial KPI Cards (QUY ĐẦU KỲ, TỔNG THU, TỔNG CHI, QUY TỒN HIỆN TẠI) */}
            <PublicSaokeSummary financial={report.financial} />

            {/* 2. IMMEDIATELY AFTER KPI CARDS: ★ THANH TOÁN QUỸ ★ (Prominent Primary Action Section) */}
            <PublicSaokePaymentSection month={month} />

            {/* 3. Income & Expense Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PublicSaokeIncome income={report.incomeBreakdown} />
              <PublicSaokeExpense expense={report.expenseBreakdown} />
            </div>

            {/* 4. Visitor Fee Section */}
            <PublicSaokeVisitorFee visitorFee={report.visitorFee} />

            {/* 5. Badminton Activity Section */}
            <PublicSaokeActivity activity={report.activity} />

            {/* 6. Task 6.9 Reports & Statistics Section */}
            <PublicSaokeReportsSection />

            {/* Architectural Boundary */}
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Tất cả dữ liệu sao kê được đối soát tự động từ hệ thống sổ quỹ 5AM.</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicSaokePage;
