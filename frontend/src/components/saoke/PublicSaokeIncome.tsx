import React from 'react';
import { PublicIncomeBreakdown } from '../../types/publicSaoke';
import { formatCurrency } from '../../utils/formatters';
import { ArrowDownLeft, ShieldCheck, UserCheck, HelpCircle } from 'lucide-react';

interface PublicSaokeIncomeProps {
  income: PublicIncomeBreakdown;
}

export const PublicSaokeIncome: React.FC<PublicSaokeIncomeProps> = ({ income }) => {
  const items = [
    {
      key: 'FIXED_FUND',
      label: 'Tiền Quỹ Cố Định',
      sublabel: 'Đóng tiền quỹ tháng cố định',
      amount: income.FIXED_FUND.amount,
      percentage: income.FIXED_FUND.percentage,
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500'
    },
    {
      key: 'VISITOR_FEE',
      label: 'Tiền Vãng Lai',
      sublabel: 'Phí chơi vãng lai theo buổi',
      amount: income.VISITOR_FEE.amount,
      percentage: income.VISITOR_FEE.percentage,
      icon: UserCheck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500'
    },
    {
      key: 'OTHER_INCOME',
      label: 'Thu Khác / Gia Nhập Giữa Tháng',
      sublabel: 'Khoản thu bổ sung',
      amount: income.OTHER_INCOME.amount,
      percentage: income.OTHER_INCOME.percentage,
      icon: HelpCircle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">CƠ CẤU NGUỒN THU QUỸ</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Báo cáo thu</span>
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
