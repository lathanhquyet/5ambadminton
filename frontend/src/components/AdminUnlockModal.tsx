import React, { useState } from 'react';
import { Unlock, AlertCircle, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface AdminUnlockModalProps {
  isOpen: boolean;
  monthKey: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminUnlockModal: React.FC<AdminUnlockModalProps> = ({
  isOpen,
  monthKey,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Bắt buộc nhập lý do mở khóa sổ sách.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/v1/closings/${monthKey}/unlock`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.response?.data?.error?.message || 'Lỗi khi mở khóa sổ sách.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Unlock className="w-5 h-5 text-amber-400" />
            <span>Mở Khóa Sổ Sách Tháng {monthKey}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Lý do mở khóa <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nhập bổ sung hóa đơn tiền sân bị sót..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed">
            ℹ️ Hành động mở khóa sổ sách sẽ được ghi lại trong <strong>Audit Log</strong> hệ thống phục vụ công tác kiểm toán.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-amber-950/40 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Xác nhận mở khóa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
