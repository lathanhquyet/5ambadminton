import React from 'react';
import { ActivityReport } from '../../types/report';
import { Layers, Users, Box, PackageCheck } from 'lucide-react';

interface ActivitySummarySectionProps {
  activity: ActivityReport;
}

export const ActivitySummarySection: React.FC<ActivitySummarySectionProps> = ({ activity }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Hoạt động cầu lông</span>
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Số buổi chơi */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Số buổi chơi</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-100">
            {activity.sessions} <span className="text-xs font-normal text-slate-400">buổi</span>
          </div>
        </div>

        {/* Tổng lượt người */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tổng lượt người</span>
            <Users className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-100">
            {activity.totalPlayers} <span className="text-xs font-normal text-slate-400">lượt</span>
          </div>
        </div>

        {/* Cầu đã dùng */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Cầu đã dùng</span>
            <Box className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-100">
            {activity.shuttleUsed} <span className="text-xs font-normal text-slate-400">quả</span>
          </div>
        </div>

        {/* Tồn kho hiện tại */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tồn kho hiện tại</span>
            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400">
            {activity.currentInventory} <span className="text-xs font-normal text-slate-400">quả</span>
          </div>
        </div>
      </div>
    </div>
  );
};
