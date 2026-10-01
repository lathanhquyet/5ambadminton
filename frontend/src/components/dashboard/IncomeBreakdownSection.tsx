import React from 'react';
import { IncomeBreakdownReport } from '../../types/report';
import { formatCurrency } from '../../utils/formatters';
import { PieChart, DollarSign } from 'lucide-react';

interface IncomeBreakdownSectionProps {
  incomeBreakdown: IncomeBreakdownReport;
}

export const IncomeBreakdownSection: React.FC<IncomeBreakdownSectionProps> = ({ incomeBreakdown }) => {
  const categories = [
    {
      key: 'FIXED_FUND',
      label: 'Quỹ cố định',
      data: incomeBreakdown.FIXED_FUND,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400'
    },
    {
      key: 'VISITOR_FEE',
      label: 'Phí vãng lai',
      data: incomeBreakdown.VISITOR_FEE,
      color: 'bg-sky-500',
      textColor: 'text-sky-400'
    },
    {
      key: 'OTHER_INCOME',
      label: 'Thu khác',
      data: incomeBreakdown.OTHER_INCOME,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-400'
    }
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span>Cơ cấu thu</span>
        </h4>
        <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
          <DollarSign className="w-4 h-4" />
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">{cat.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">{formatCurrency(cat.data.amount)}</span>
                <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 ${cat.textColor}`}>
                  {cat.data.percentage}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full ${cat.color} transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, cat.data.percentage))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
