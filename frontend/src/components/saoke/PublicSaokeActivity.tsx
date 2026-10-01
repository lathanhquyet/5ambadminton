import React from 'react';
import { PublicActivitySummary } from '../../types/publicSaoke';
import { Layers, Users, Box, Package } from 'lucide-react';

interface PublicSaokeActivityProps {
  activity: PublicActivitySummary;
}

export const PublicSaokeActivity: React.FC<PublicSaokeActivityProps> = ({ activity }) => {
  // Format shuttle pieces to tubes (1 tube = 12 pieces)
  const formatTubes = (pieces: number) => {
    const tubes = Math.floor(pieces / 12);
    const rem = pieces % 12;
    if (tubes === 0) return `${pieces} quả`;
    if (rem === 0) return `${tubes} hộp`;
    return `${tubes} hộp ${rem} quả`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">HOẠT ĐỘNG CẦU LÔNG & TỒN KHO</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Thống kê vận hành</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sessions Count */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Số buổi đã chơi</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{activity.sessions} buổi</div>
          <p className="text-[11px] text-slate-500 mt-1">Trong kỳ báo cáo</p>
        </div>

        {/* Total Players */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Tổng lượt thành viên</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{activity.totalPlayers} lượt</div>
          <p className="text-[11px] text-slate-500 mt-1">Lượt điểm danh có mặt</p>
        </div>

        {/* Shuttle Used */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Cầu lông đã dùng</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatTubes(activity.shuttleUsed)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tiêu hao các buổi chơi</p>
        </div>

        {/* Current Inventory */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Tồn kho cầu TC77</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {formatTubes(activity.currentInventory)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tồn kho sẵn có</p>
        </div>
      </div>
    </div>
  );
};
