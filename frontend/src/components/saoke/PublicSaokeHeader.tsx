import React from 'react';
import { Activity, ShieldCheck, Eye } from 'lucide-react';

export const PublicSaokeHeader: React.FC = () => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shadow-inner">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="font-black text-white text-xl tracking-tight leading-none flex items-center gap-2">
              <span>QUỸ CẦU LÔNG 5AM</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold font-mono">
                RISE & SHINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cổng Sao Kê Thu — Chi — Tồn Công Khai</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Dữ liệu minh bạch toàn bộ thành viên</span>
        </div>
      </div>
    </header>
  );
};
