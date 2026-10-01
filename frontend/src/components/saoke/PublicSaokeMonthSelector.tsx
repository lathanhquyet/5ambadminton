import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { formatMonthDisplay } from '../../utils/formatters';

interface PublicSaokeMonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  disabled?: boolean;
}

export const PublicSaokeMonthSelector: React.FC<PublicSaokeMonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
  disabled = false,
}) => {
  // Generate selectable months (past 12 months)
  const generateMonthOptions = () => {
    const options = [];
    const baseYear = 2026;
    const baseMonth = 10;

    for (let i = 0; i < 12; i++) {
      let m = baseMonth - i;
      let y = baseYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const monthStr = m < 10 ? `0${m}` : `${m}`;
      const monthKey = `${y}-${monthStr}`;
      options.push({
        key: monthKey,
        label: formatMonthDisplay(monthKey)
      });
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="relative inline-block w-full sm:w-auto">
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus-within:ring-2 focus-within:ring-emerald-500 shadow-md">
        <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          disabled={disabled}
          className="bg-transparent text-white font-semibold text-sm focus:outline-none cursor-pointer w-full pr-6 appearance-none font-mono"
        >
          {monthOptions.map((opt) => (
            <option key={opt.key} value={opt.key} className="bg-slate-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3" />
      </div>
    </div>
  );
};
