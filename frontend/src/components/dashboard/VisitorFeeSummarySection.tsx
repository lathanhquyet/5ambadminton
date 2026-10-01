import React from 'react';
import { VisitorFeeReport } from '../../types/report';
import { formatCurrency } from '../../utils/formatters';
import { UserCheck, CheckCircle2, Clock, Landmark } from 'lucide-react';

interface VisitorFeeSummarySectionProps {
  visitorFee: VisitorFeeReport;
}

export const VisitorFeeSummarySection: React.FC<VisitorFeeSummarySectionProps> = ({ visitorFee }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-sky-400" />
          <span>Phí khách vãng lai</span>
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Phải thu */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Phải thu</span>
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-base font-bold text-slate-100">
            {formatCurrency(visitorFee.due)}
          </div>
        </div>

        {/* Đã thu */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Đã thu</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-emerald-400">
            {formatCurrency(visitorFee.collected)}
          </div>
        </div>

        {/* Còn thiếu */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Còn thiếu</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-bold text-amber-400">
            {formatCurrency(visitorFee.outstanding)}
          </div>
        </div>

        {/* Tiền đã vào quỹ */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tiền đã vào quỹ</span>
            <Landmark className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-emerald-400">
            {formatCurrency(visitorFee.cashIncome)}
          </div>
        </div>
      </div>
    </div>
  );
};
