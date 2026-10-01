import React from 'react';
import { PublicExpenseBreakdown } from '../../types/publicSaoke';
import { formatCurrency } from '../../utils/formatters';
import { ArrowUpRight, MapPin, Package, MoreHorizontal } from 'lucide-react';

interface PublicSaokeExpenseProps {
  expense: PublicExpenseBreakdown;
}

export const PublicSaokeExpense: React.FC<PublicSaokeExpenseProps> = ({ expense }) => {
  const items = [
    {
      key: 'COURT_FEE',
      label: 'Chi Trả Tiền Sân Cầu',
      sublabel: 'Thanh toán tiền cố định sân',
      amount: expense.COURT_FEE.amount,
      percentage: expense.COURT_FEE.percentage,
      icon: MapPin,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500'
    },
    {
      key: 'SHUTTLE_PURCHASE',
      label: 'Chi Mua Cầu Lông (Hộp)',
      sublabel: 'Mua cầu TC77 nhập kho',
      amount: expense.SHUTTLE_PURCHASE.amount,
      percentage: expense.SHUTTLE_PURCHASE.percentage,
      icon: Package,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500'
    },
    {
      key: 'OTHER_EXPENSE',
      label: 'Chi Phí Khác (Nước, Giao lưu...)',
      sublabel: 'Các khoản chi hoạt động khác',
      amount: expense.OTHER_EXPENSE.amount,
      percentage: expense.OTHER_EXPENSE.percentage,
      icon: MoreHorizontal,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">CƠ CẤU MỤC CHI QUỸ</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Báo cáo chi</span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const IconComp = item.icon;
          return (
            <div key={item.key} className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconComp className={`w-4 h-4 ${item.color}`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.sublabel}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-white">{formatCurrency(item.amount)}</div>
                  <div className="text-xs font-mono text-slate-400">{item.percentage}%</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${item.bgColor}`}
                  style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
