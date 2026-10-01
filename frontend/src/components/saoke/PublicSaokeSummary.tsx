import React from 'react';
import { PublicFinancialSummary } from '../../types/publicSaoke';
import { formatCurrency } from '../../utils/formatters';
import { Wallet, TrendingUp, TrendingDown, Landmark } from 'lucide-react';

interface PublicSaokeSummaryProps {
  financial: PublicFinancialSummary;
}

export const PublicSaokeSummary: React.FC<PublicSaokeSummaryProps> = ({ financial }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Opening Balance */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">QUỸ ĐẦU KỲ</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold font-mono text-white tracking-tight">
          {formatCurrency(financial.openingBalance)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Kết chuyển từ kỳ trước</p>
      </div>

      {/* Total Income */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">TỔNG THU TRONG THÁNG</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {formatCurrency(financial.totalIncome)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Tổng thực nhận quỹ</p>
      </div>

      {/* Total Expense */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">TỔNG CHI TRONG THÁNG</span>
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold font-mono text-rose-400 tracking-tight">
          {formatCurrency(financial.totalExpense)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Tiền sân, mua cầu, chi khác</p>
      </div>

      {/* Ending Balance */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">QUỸ TỒN HIỆN TẠI</span>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div
          className={`mt-3 text-2xl font-bold font-mono tracking-tight ${
            financial.endingBalance < 0 ? 'text-rose-400' : 'text-amber-400'
          }`}
        >
          {formatCurrency(financial.endingBalance)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {financial.endingBalance < 0 ? 'Cảnh báo: Âm quỹ' : 'Quỹ tiền mặt sẵn có'}
        </p>
      </div>
    </div>
  );
};
