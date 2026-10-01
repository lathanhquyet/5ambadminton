import React, { useState } from 'react';
import { createOtherExpense, createShuttlePurchaseExpense, createCourtFeeExpense } from '../../api/transactionApi';
import { apiClient } from '../../api/client';
import { getCurrentDateStr } from '../../utils/dateUtils';
import { FileMinus, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ExpenseVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  onSuccess: () => void;
}

export const ExpenseVoucherModal: React.FC<ExpenseVoucherModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'COURT' | 'SHUTTLE' | 'OTHER'>('COURT');

  // Court Fee Form
  const [courtDate, setCourtDate] = useState(getCurrentDateStr());
  const [courtDesc, setCourtDesc] = useState(`Chi phí thuê sân tháng ${monthKey}`);
  const [courtRecipient, setCourtRecipient] = useState('Chủ sân cầu lông');
  const [courtAmount, setCourtAmount] = useState<number>(1200000);
  const [courtPayMethod, setCourtPayMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');

  // Shuttlecock Purchase Form
  const [shuttleDate, setShuttleDate] = useState(getCurrentDateStr());
  const [supplier, setSupplier] = useState('Đại lý Yonex');
  const [tubesQty, setTubesQty] = useState<number>(10);
  const [pricePerTube, setPricePerTube] = useState<number>(250000);

  // Other Expense Form
  const [otherDate, setOtherDate] = useState(getCurrentDateStr());
  const [otherDesc, setOtherDesc] = useState('');
  const [otherRecipient, setOtherRecipient] = useState('');
  const [otherAmount, setOtherAmount] = useState<number>(100000);
  const [otherPayMethod, setOtherPayMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCourtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courtAmount <= 0) {
      setError('Số tiền phí sân phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createCourtFeeExpense({
        transaction_date: courtDate,
        month_key: monthKey,
        description: courtDesc.trim() || `Chi phí thuê sân tháng ${monthKey}`,
        recipient: courtRecipient.trim() || 'Chủ sân cầu lông',
        amount: courtAmount,
        payment_method: courtPayMethod
      });

      setSuccessMsg(`Đã tạo phiếu chi phí sân (${courtAmount.toLocaleString()} ₫) thành công.`);
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo phiếu chi phí sân.');
    } finally {
      setLoading(false);
    }
  };

  const handleShuttleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      setError('Vui lòng nhập tên nhà cung cấp cầu.');
      return;
    }
    if (tubesQty <= 0 || pricePerTube <= 0) {
      setError('Số lượng và đơn giá phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createShuttlePurchaseExpense({
        purchase_date: shuttleDate,
        month_key: monthKey,
        supplier: supplier.trim(),
        tubes_qty: tubesQty,
        price_per_tube: pricePerTube
      });

      const total = tubesQty * pricePerTube;
      setSuccessMsg(`Đã tạo phiếu chi mua cầu (${total.toLocaleString()} ₫ + Nhập ${tubesQty * 12} quả vào Kho) thành công.`);
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo phiếu chi mua cầu.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherDesc.trim()) {
      setError('Vui lòng nhập nội dung chi khác.');
      return;
    }
    if (otherAmount <= 0) {
      setError('Số tiền chi khác phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createOtherExpense({
        transaction_date: otherDate,
        month_key: monthKey,
        description: otherDesc.trim(),
        recipient: otherRecipient.trim() || undefined,
        amount: otherAmount,
        payment_method: otherPayMethod
      });

      setSuccessMsg(`Đã tạo phiếu chi khác (${otherAmount.toLocaleString()} ₫) thành công.`);
      setOtherDesc('');
      setOtherRecipient('');
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tạo phiếu chi khác.');
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
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <FileMinus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Lập Phiếu Chi Quỹ</h3>
              <p className="text-xs text-slate-400">Ghi nhận khoản chi ra khỏi Sổ quỹ (Tháng {monthKey})</p>
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
            onClick={() => { setActiveTab('COURT'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'COURT'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phí sân
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('SHUTTLE'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'SHUTTLE'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mua cầu
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('OTHER'); setError(null); }}
            className={`py-2 px-2 rounded-lg font-semibold transition text-center ${
              activeTab === 'OTHER'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chi khác
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

        {/* Tab 1: Court Fee */}
        {activeTab === 'COURT' && (
          <form onSubmit={handleCourtSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày chi:</label>
                <input
                  type="date"
                  value={courtDate}
                  onChange={(e) => setCourtDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hình thức:</label>
                <select
                  value={courtPayMethod}
                  onChange={(e) => setCourtPayMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CASH">Tiền mặt (CASH)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nội dung chi phí sân:</label>
              <input
                type="text"
                value={courtDesc}
                onChange={(e) => setCourtDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Người nhận / Chủ sân:</label>
              <input
                type="text"
                value={courtRecipient}
                onChange={(e) => setCourtRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số tiền (VND):</label>
              <input
                type="number"
                value={courtAmount}
                onChange={(e) => setCourtAmount(Number(e.target.value))}
                placeholder="1200000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-rose-400 font-bold font-mono focus:outline-none focus:border-rose-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Số tiền chi recorded nguyên gốc không làm tròn.
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-rose-950/40 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang lưu...' : 'Lưu phiếu chi'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Shuttlecock Purchase */}
        {activeTab === 'SHUTTLE' && (
          <form onSubmit={handleShuttleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày mua:</label>
                <input
                  type="date"
                  value={shuttleDate}
                  onChange={(e) => setShuttleDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nhà cung cấp (*):</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Đại lý Yonex..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Số ống mua:</label>
                <input
                  type="number"
                  value={tubesQty}
                  onChange={(e) => setTubesQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  required
                />
                <span className="text-[10px] text-emerald-400 mt-1 block">
                  = {tubesQty * 12} quả cầu (nhập kho)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Đơn giá / Ống (VND):</label>
                <input
                  type="number"
                  value={pricePerTube}
                  onChange={(e) => setPricePerTube(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">Tổng tiền thanh toán:</span>
              <span className="font-mono font-bold text-rose-400 text-sm">
                {(tubesQty * pricePerTube).toLocaleString()} ₫
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-rose-950/40 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang lưu...' : 'Lưu phiếu chi & Nhập kho'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Other Expense */}
        {activeTab === 'OTHER' && (
          <form onSubmit={handleOtherSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày chi:</label>
                <input
                  type="date"
                  value={otherDate}
                  onChange={(e) => setOtherDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hình thức:</label>
                <select
                  value={otherPayMethod}
                  onChange={(e) => setOtherPayMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CASH">Tiền mặt (CASH)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nội dung chi khác (*):</label>
              <input
                type="text"
                placeholder="Ví dụ: Mua nước uống, Sửa vợt..."
                value={otherDesc}
                onChange={(e) => setOtherDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Người nhận tiền:</label>
              <input
                type="text"
                placeholder="Ví dụ: Cửa hàng tiện lợi..."
                value={otherRecipient}
                onChange={(e) => setOtherRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số tiền (VND):</label>
              <input
                type="number"
                value={otherAmount}
                onChange={(e) => setOtherAmount(Number(e.target.value))}
                placeholder="100000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-rose-400 font-bold font-mono focus:outline-none focus:border-rose-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Số tiền chi recorded nguyên gốc không làm tròn.
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-rose-950/40 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Đang lưu...' : 'Lưu phiếu chi'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
