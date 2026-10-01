import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { getCurrentDateStr } from '../utils/dateUtils';
import { Package, PlusCircle, MinusCircle, Sliders, RefreshCw, AlertCircle } from 'lucide-react';

interface StockSummary {
  product_id: string;
  product_code: string;
  product_name: string;
  pieces_per_tube: number;
  total_pieces: number;
  tubes_formatted: string;
}

interface InventoryTransaction {
  id: string;
  transaction_date: string;
  month_key: string;
  product_name: string;
  transaction_type: 'RECEIPT' | 'USAGE' | 'REFUND' | 'ADJUSTMENT';
  quantity_in_pieces: number;
  reference_type: string;
  notes: string | null;
  created_at: string;
}

export const InventoryPage: React.FC = () => {
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Form states
  const [receiptForm, setReceiptForm] = useState({
    date: getCurrentDateStr(),
    tubes_qty: 0,
    pieces_qty: 0,
    supplier: '',
    notes: ''
  });

  const [issueForm, setIssueForm] = useState({
    date: getCurrentDateStr(),
    tubes_qty: 0,
    pieces_qty: 0,
    reason: '',
    notes: ''
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    date: new Date().toISOString().substring(0, 10),
    adjustment_type: 'INCREASE' as 'INCREASE' | 'DECREASE',
    quantity_in_pieces: 0,
    reason: '',
    notes: ''
  });

  const fetchInventoryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await apiClient.get('/inventory/summary');
      setStockSummary(summaryRes.data.data);

      const txRes = await apiClient.get('/inventory/transactions');
      setTransactions(txRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Lỗi khi tải dữ liệu tồn kho.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const handleManualReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await apiClient.post('/inventory/receipt', receiptForm);
      setSuccessMsg('Ghi nhận nhập kho thủ công thành công.');
      setShowReceiptModal(false);
      fetchInventoryData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Lỗi khi nhập kho.');
    }
  };

  const handleManualIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      await apiClient.post('/inventory/issue', issueForm);
      setSuccessMsg('Ghi nhận xuất kho thủ công thành công.');
      setShowIssueModal(false);
      fetchInventoryData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Lỗi khi xuất kho.');
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!adjustmentForm.reason.trim()) {
      setError('Lý do điều chỉnh tồn kho là bắt buộc.');
      return;
    }

    try {
      await apiClient.post('/inventory/adjustment', adjustmentForm);
      setSuccessMsg('Điều chỉnh tồn kho thành công.');
      setShowAdjustmentModal(false);
      fetchInventoryData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Lỗi khi điều chỉnh tồn kho.');
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'RECEIPT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'USAGE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'REFUND':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'ADJUSTMENT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>QUẢN LÝ KHO & TỒN KHO CẦU</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Source of truth từ lịch sử giao dịch `inventory_transactions`.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowReceiptModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nhập kho</span>
          </button>
          <button
            onClick={() => setShowIssueModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-rose-950/40"
          >
            <MinusCircle className="w-4 h-4" />
            <span>Xuất kho</span>
          </button>
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-amber-950/40"
          >
            <Sliders className="w-4 h-4" />
            <span>Điều chỉnh</span>
          </button>
          <button
            onClick={fetchInventoryData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition border border-slate-700"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
          {successMsg}
        </div>
      )}

      {/* Stock Summary Card */}
      {stockSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="text-xs text-slate-400 font-semibold">TỔN KHO HIỆN TẠI</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-2">
              {stockSummary.tubes_formatted}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Tổng số trái: <span className="font-mono text-slate-300 font-semibold">{stockSummary.total_pieces} trái</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="text-xs text-slate-400 font-semibold">SẢN PHẨM MẶC ĐỊNH</div>
            <div className="text-lg font-bold text-white mt-2">{stockSummary.product_name}</div>
            <div className="text-xs text-slate-500 mt-1">
              Quy cách: <span className="text-slate-300 font-semibold">{stockSummary.pieces_per_tube} trái / ống</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-semibold">NGUYÊN TẮC HỆ THỐNG</div>
            <div className="text-xs text-slate-400 mt-2 leading-relaxed">
              - Xuất/nhập kho thủ công chỉ làm thay đổi số lượng tồn kho.<br />
              - Không tự động sinh giao dịch thu/chi tiền (Expense).
            </div>
          </div>
        </div>
      )}

      {/* Transactions History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Lịch sử Nhập / Xuất / Điều chỉnh kho</h2>
          <span className="text-xs font-mono text-slate-400">
            Tổng giao dịch: {transactions.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Đang tải lịch sử tồn kho...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Chưa có giao dịch kho nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Ngày</th>
                  <th className="px-6 py-3.5">Loại giao dịch</th>
                  <th className="px-6 py-3.5">Số lượng (Trái)</th>
                  <th className="px-6 py-3.5">Nguồn / Reference</th>
                  <th className="px-6 py-3.5">Ghi chú / Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-mono text-xs">{tx.transaction_date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getTypeBadgeClass(tx.transaction_type)}`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold">
                      {tx.quantity_in_pieces > 0 ? (
                        <span className="text-emerald-400">+{tx.quantity_in_pieces}</span>
                      ) : (
                        <span className="text-rose-400">{tx.quantity_in_pieces}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{tx.reference_type}</td>
                    <td className="px-6 py-4 text-xs text-slate-300">{tx.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nhập Kho */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Nhập Kho Thủ Công</h3>
            <form onSubmit={handleManualReceipt} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Ngày nhập</label>
                <input
                  type="date"
                  value={receiptForm.date}
                  onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Số ống</label>
                  <input
                    type="number"
                    min="0"
                    value={receiptForm.tubes_qty}
                    onChange={(e) => setReceiptForm({ ...receiptForm, tubes_qty: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Số trái lẻ</label>
                  <input
                    type="number"
                    min="0"
                    value={receiptForm.pieces_qty}
                    onChange={(e) => setReceiptForm({ ...receiptForm, pieces_qty: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Nhà cung cấp (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="VD: Cửa hàng Thể Thao X"
                  value={receiptForm.supplier}
                  onChange={(e) => setReceiptForm({ ...receiptForm, supplier: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Ghi chú</label>
                <textarea
                  rows={2}
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
                >
                  Xác nhận nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xuất Kho */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Xuất Kho Thủ Công</h3>
            <form onSubmit={handleManualIssue} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Ngày xuất</label>
                <input
                  type="date"
                  value={issueForm.date}
                  onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Số ống</label>
                  <input
                    type="number"
                    min="0"
                    value={issueForm.tubes_qty}
                    onChange={(e) => setIssueForm({ ...issueForm, tubes_qty: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Số trái lẻ</label>
                  <input
                    type="number"
                    min="0"
                    value={issueForm.pieces_qty}
                    onChange={(e) => setIssueForm({ ...issueForm, pieces_qty: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Lý do xuất kho</label>
                <input
                  type="text"
                  placeholder="VD: Xuất tập luyện giao hữu"
                  value={issueForm.reason}
                  onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
                >
                  Xác nhận xuất kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Điều Chỉnh Tồn Kho */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Điều Chỉnh Tồn Kho</h3>
            <form onSubmit={handleManualAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Ngày điều chỉnh</label>
                <input
                  type="date"
                  value={adjustmentForm.date}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Loại điều chỉnh</label>
                <select
                  value={adjustmentForm.adjustment_type}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: e.target.value as 'INCREASE' | 'DECREASE' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="INCREASE">TĂNG TỒN KHO (+)</option>
                  <option value="DECREASE">GIẢM TỒN KHO (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Số lượng (Tính theo Trái)</label>
                <input
                  type="number"
                  min="1"
                  value={adjustmentForm.quantity_in_pieces}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity_in_pieces: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Lý do điều chỉnh (BẮT BUỘC)</label>
                <input
                  type="text"
                  placeholder="VD: Kiểm kê định kỳ phát hiện hỏng 3 trái"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold"
                >
                  Xác nhận điều chỉnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
