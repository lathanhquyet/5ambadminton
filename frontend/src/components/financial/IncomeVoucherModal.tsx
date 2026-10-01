import React, { useState } from 'react';
import { createVisitorFeeIncome, createOtherIncome } from '../../api/transactionApi';
import { getCurrentDateStr } from '../../utils/dateUtils';
import { FilePlus, X, CheckCircle2, AlertCircle, DollarSign, UserCheck, CreditCard, Calendar, Info } from 'lucide-react';

interface IncomeVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  onSuccess: () => void;
  onNavigateToDebts?: () => void;
}

export const IncomeVoucherModal: React.FC<IncomeVoucherModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  onSuccess,
  onNavigateToDebts
}) => {
  const [activeTab, setActiveTab] = useState<'VISITOR' | 'OTHER' | 'MEMBER_NOTICE'>('VISITOR');
  
  // Visitor Form
  const [date, setDate] = useState(getCurrentDateStr());
  const [visitorName, setVisitorName] = useState('');
  const [visitorAmount, setVisitorAmount] = useState<number>(50000); // Default 50,000 VND
  const [visitorPayMethod, setVisitorPayMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');

  // Other Income Form
  const [otherDate, setOtherDate] = useState(getCurrentDateStr());
  const [otherDesc, setOtherDesc] = useState('');
  const [otherSource, setOtherSource] = useState('');
  const [otherAmount, setOtherAmount] = useState<number>(100000);
  const [otherPayMethod, setOtherPayMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (visitorAmount <= 0) {
      setError('Số tiền thu phí vãng lai phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createVisitorFeeIncome({
        transaction_date: date,
        month_key: monthKey,
        payer_name: visitorName.trim() || undefined,
        amount: visitorAmount,
        payment_method: visitorPayMethod
      });

      setSuccessMsg(`Đã tạo phiếu thu phí vãng lai (${visitorAmount.toLocaleString()} ₫) thành công.`);
      setVisitorName('');
      setVisitorAmount(50000);
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo phiếu thu vãng lai.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtherIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherDesc.trim()) {
      setError('Vui lòng nhập nội dung thu khác.');
      return;
    }
    if (otherAmount <= 0) {
      setError('Số tiền thu khác phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createOtherIncome({
        transaction_date: otherDate,
        month_key: monthKey,
        description: otherDesc.trim(),
        source: otherSource.trim() || undefined,
        amount: otherAmount,
        payment_method: otherPayMethod
      });

      setSuccessMsg(`Đã tạo phiếu thu khác (${otherAmount.toLocaleString()} ₫) thành công.`);
      setOtherDesc('');
      setOtherSource('');
      setOtherAmount(100000);
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo phiếu thu khác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Lập Phiếu Thu Quỹ</h3>
              <p className="text-xs text-slate-400">Ghi nhận khoản tiền thu vào Sổ quỹ (Tháng {monthKey})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab('VISITOR'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'VISITOR'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phí vãng lai
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('OTHER'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'OTHER'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Thu khác
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('MEMBER_NOTICE'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'MEMBER_NOTICE'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phí thành viên
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Visitor Fee */}
        {activeTab === 'VISITOR' && (
          <form onSubmit={handleVisitorSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày thu:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hình thức:</label>
                <select
                  value={visitorPayMethod}
                  onChange={(e) => setVisitorPayMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Người nộp (Khách vãng lai):</label>
              <input
                type="text"
                placeholder="Tên khách chơi vãng lai..."
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số tiền (VND):</label>
              <input
                type="number"
                value={visitorAmount}
                onChange={(e) => setVisitorAmount(Number(e.target.value))}
                placeholder="50000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-amber-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Mặc định 50.000đ. Số tiền ghi nhận chính xác không làm tròn.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang lưu...' : 'Lưu phiếu thu'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Other Income */}
        {activeTab === 'OTHER' && (
          <form onSubmit={handleOtherIncomeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày thu:</label>
                <input
                  type="date"
                  value={otherDate}
                  onChange={(e) => setOtherDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hình thức:</label>
                <select
                  value={otherPayMethod}
                  onChange={(e) => setOtherPayMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CASH">Tiền mặt (CASH)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nội dung thu khác (*):</label>
              <input
                type="text"
                placeholder="Ví dụ: Thu bán đồ cũ, Tài trợ giải..."
                value={otherDesc}
                onChange={(e) => setOtherDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nguồn thu / Người nộp:</label>
              <input
                type="text"
                placeholder="Ví dụ: Anh Nam, Nhà tài trợ..."
                value={otherSource}
                onChange={(e) => setOtherSource(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số tiền (VND):</label>
              <input
                type="number"
                value={otherAmount}
                onChange={(e) => setOtherAmount(Number(e.target.value))}
                placeholder="100000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-amber-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Ghi nhận con số chính xác người nộp, không thực hiện làm tròn.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang lưu...' : 'Lưu phiếu thu'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Member Fee Notice */}
        {activeTab === 'MEMBER_NOTICE' && (
          <div className="space-y-4 py-2">
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Info className="w-4 h-4" />
                <span>Quy trình nộp Phí thành viên</span>
              </div>
              <p>
                Phí thành viên cố định được quản lý tự động thông qua công nợ của từng thành viên. Để đảm bảo không bị thu trùng hoặc lệch sổ sách, khoản thu này chỉ được sinh ra khi xác nhận thanh toán tại mục <strong className="text-white">Công nợ</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Đóng
              </button>
              {onNavigateToDebts && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToDebts();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Đi tới Công nợ</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
