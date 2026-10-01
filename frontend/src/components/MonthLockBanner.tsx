import React from 'react';
import { Lock, Unlock } from 'lucide-react';

interface MonthLockBannerProps {
  monthKey: string;
  isClosed: boolean;
  isAdmin?: boolean;
  onUnlockClick?: () => void;
  unlockedReason?: string;
  closedAt?: string;
}

export const MonthLockBanner: React.FC<MonthLockBannerProps> = ({
  monthKey,
  isClosed,
  isAdmin = false,
  onUnlockClick,
  unlockedReason,
  closedAt
}) => {
  if (!isClosed) {
    if (unlockedReason) {
      return (
        <div className="mb-4 p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-2xl flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Tháng <strong>{monthKey}</strong> đã được Admin mở khóa. Lý do: <em>"{unlockedReason}"</em>
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-amber-950/40 border border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wide">
            SỔ SÁCH TÀI CHÍNH THÁNG {monthKey} ĐÃ KHÓA (CLOSED)
          </h4>
          <p className="text-[11px] text-amber-300/80 mt-0.5">
            Dữ liệu tài chính tháng này đã chốt. Mọi thao tác thêm/sửa/xóa giao dịch đã bị chặn.
            {closedAt && ` (Thời gian chốt: ${new Date(closedAt).toLocaleString('vi-VN')})`}
          </p>
        </div>
      </div>

      {isAdmin && onUnlockClick && (
        <button
          onClick={onUnlockClick}
          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl transition shadow-md shrink-0 flex items-center gap-1.5"
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>Mở khóa sổ sách</span>
        </button>
      )}
    </div>
  );
};
