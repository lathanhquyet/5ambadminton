import React from 'react';
import { MonthlyFinancialReport } from '../../types/report';
import { formatCurrency } from '../../utils/formatters';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Scale } from 'lucide-react';

interface FinancialSummarySectionProps {
  financial: MonthlyFinancialReport;
}

export const FinancialSummarySection: React.FC<FinancialSummarySectionProps> = ({ financial }) => {
  const isNegativeEnding = financial.endingBalance < 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-400" />
          <span>Tổng quan tài chính quỹ</span>
        </h3>
        <span className="text-xs text-slate-400 font-mono">
          Số dư đầu kỳ: <strong className="text-slate-200">{formatCurrency(financial.openingBalance)}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Đã thu */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Đã thu</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 tracking-tight">
            {formatCurrency(financial.totalIncome)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Tổng tiền thực thu trong kỳ</span>
        </div>

        {/* KPI 2: Đã chi */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Đã chi</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-rose-400 tracking-tight">
            {formatCurrency(financial.totalExpense)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Tổng chi phí thực xuất trong kỳ</span>
        </div>

        {/* KPI 3: Chưa thu */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Chưa thu (Công nợ)</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-amber-400 tracking-tight">
            {formatCurrency(financial.outstandingDebt || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Tổng nợ phí chưa đóng</span>
        </div>

        {/* KPI 4: Tồn quỹ */}
        <div className={`border p-4 rounded-2xl flex flex-col justify-between shadow-sm ${
          isNegativeEnding
            ? 'bg-rose-950/20 border-rose-800/60'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Tồn quỹ (Số dư)</span>
            <div className={`p-2 rounded-lg ${
              isNegativeEnding ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-extrabold tracking-tight ${
            isNegativeEnding ? 'text-rose-400' : 'text-emerald-300'
          }`}>
            {formatCurrency(financial.endingBalance)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Sổ quỹ tiền mặt hiện tại</span>
        </div>
      </div>
    </div>
  );
};
