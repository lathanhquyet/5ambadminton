import React from 'react';
import { Calendar } from 'lucide-react';
import { formatMonthDisplay } from '../../utils/formatters';

interface ReportMonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (newMonth: string) => void;
  disabled?: boolean;
}

export const ReportMonthSelector: React.FC<ReportMonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
  disabled = false
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-sm">
      <label htmlFor="dashboard-month-select" className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span>Tháng báo cáo:</span>
      </label>
      <div className="relative">
        <input
          id="dashboard-month-select"
          type="month"
          value={selectedMonth}
          onChange={(e) => {
            if (e.target.value) {
              onMonthChange(e.target.value);
            }
          }}
          disabled={disabled}
          className="bg-slate-950 border border-slate-700 text-slate-100 font-bold px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition cursor-pointer disabled:opacity-50"
        />
        <span className="sr-only">{formatMonthDisplay(selectedMonth)}</span>
      </div>
    </div>
  );
};
