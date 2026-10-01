import React from 'react';
import { PublicVisitorFeeSummary } from '../../types/publicSaoke';
import { formatCurrency } from '../../utils/formatters';
import { UserCheck, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';

interface PublicSaokeVisitorFeeProps {
  visitorFee: PublicVisitorFeeSummary;
}

export const PublicSaokeVisitorFee: React.FC<PublicSaokeVisitorFeeProps> = ({ visitorFee }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">TỔNG HỢP PHÍ VÃNG LAI</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Thu phí vãng lai</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Visitor Due */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Phát sinh vãng lai</div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {formatCurrency(visitorFee.due)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Tổng phí các buổi vãng lai</div>
        </div>

        {/* Collected */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã thu vãng lai</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {formatCurrency(visitorFee.collected)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Thực tế đã thanh toán</div>
        </div>

        {/* Outstanding */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Chưa thu (Công nợ)</span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {formatCurrency(visitorFee.outstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Còn thiếu chờ thu sau</div>
        </div>

        {/* Cash Income */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-blue-400 font-medium flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Quỹ nhập từ vãng lai</span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-400 mt-1">
            {formatCurrency(visitorFee.cashIncome)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Đã cộng vào quỹ tiền mặt</div>
        </div>
      </div>
    </div>
  );
};
