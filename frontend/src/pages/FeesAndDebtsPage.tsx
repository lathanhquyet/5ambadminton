import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { getCurrentMonthKey, getCurrentDateStr } from '../utils/dateUtils';
import { CreditCard, QrCode, Calculator, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Building2, FilePlus, FileMinus, History } from 'lucide-react';
import { AdminPaymentSettingsModal } from '../components/AdminPaymentSettingsModal';
import { IncomeVoucherModal } from '../components/financial/IncomeVoucherModal';
import { ExpenseVoucherModal } from '../components/financial/ExpenseVoucherModal';
import { TransactionHistoryView } from '../components/financial/TransactionHistoryView';

interface MemberDebt {
  member_id: string;
  member_name: string;
  member_type: 'FIXED' | 'VISITOR';
  days_per_week: number;
  total_fee_required: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'PAYMENT_REQUESTED';
}

interface VietQRData {
  bank_name: string;
  account_number: string;
  account_holder: string;
  amount: number;
  description: string;
  vietqr_url: string;
}

export const FeesAndDebtsPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [debts, setDebts] = useState<MemberDebt[]>([]);
  const [loading, setLoading] = useState(true);

  // Fee Calculation Modal
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcMethod, setCalcMethod] = useState<'EQUAL_SPLIT' | 'BY_REGISTERED_DAYS' | 'MANUAL'>('BY_REGISTERED_DAYS');
  const [totalCostToAllocate, setTotalCostToAllocate] = useState<number>(7750000);
  const [visitorPrice, setVisitorPrice] = useState<number>(70000);
  const [calculating, setCalculating] = useState(false);

  // Payment Modal
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<MemberDebt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [bankTxCode, setBankTxCode] = useState('');
  const [paymentDate, setPaymentDate] = useState(getCurrentDateStr());
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // QR Modal
  const [qrData, setQrData] = useState<VietQRData | null>(null);
  const [qrModalMember, setQrModalMember] = useState<string | null>(null);

  // Admin Bank Settings Modal
  const [isAdminBankModalOpen, setIsAdminBankModalOpen] = useState(false);

  // Income & Expense Voucher Modals
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Sub Tab Navigation
  const [subTab, setSubTab] = useState<'DEBTS' | 'HISTORY'>('DEBTS');

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/debts?month=${month}`);
      setDebts(res.data.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [month]);

  const handleConfirmVisitorPaymentByAdmin = async (memberId: string) => {
    try {
      await apiClient.post('/sessions/visitor-fees/confirm-payment', {
        member_id: memberId,
        month_key: month,
        payment_method: 'BANK_TRANSFER'
      });
      fetchDebts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Xác nhận thu tiền thất bại.');
    }
  };

  const handleCalculateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    try {
      await apiClient.post('/fees/calculate-monthly', {
        month_key: month,
        calculation_method: calcMethod,
        total_cost: totalCostToAllocate,
        visitor_price: visitorPrice
      });
      setIsCalcModalOpen(false);
      fetchDebts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Tính phí thất bại.');
    } finally {
      setCalculating(false);
    }
  };

  const openPaymentModal = (member: MemberDebt) => {
    setSelectedMemberForPayment(member);
    setPaymentAmount(member.remaining_amount); // Default to full remaining debt
    setPaymentError(null);
    setPaymentMethod('BANK_TRANSFER');
    setBankTxCode('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForPayment) return;

    if (paymentAmount > selectedMemberForPayment.remaining_amount) {
      setPaymentError(
        `Số tiền đóng (${paymentAmount.toLocaleString()}đ) vượt quá số nợ còn thiếu (${selectedMemberForPayment.remaining_amount.toLocaleString()}đ). Hệ thống không hỗ trợ overpaid.`
      );
      return;
    }

    setPaying(true);
    setPaymentError(null);

    try {
      await apiClient.post('/payments', {
        member_id: selectedMemberForPayment.member_id,
        month_key: month,
        payment_date: paymentDate,
        amount: paymentAmount,
        payment_method: paymentMethod,
        bank_tx_code: bankTxCode
      });

      setSelectedMemberForPayment(null);
      fetchDebts();
    } catch (err: any) {
      setPaymentError(err.response?.data?.error?.message || 'Ghi nhận đóng tiền thất bại.');
    } finally {
      setPaying(false);
    }
  };

  const handleOpenQR = async (member: MemberDebt) => {
    try {
      const res = await apiClient.get(`/payments/${member.member_id}/qr?month=${month}`);
      setQrData(res.data.data);
      setQrModalMember(member.member_name);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Không thể tạo mã QR.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Calc trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            <span>QUẢN LÝ QUỸ, CÔNG NỢ & THANH TOÁN</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Chi phí tự động làm tròn ROUNDUP đến 10.000đ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            onClick={() => setIsIncomeModalOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 text-xs sm:text-sm"
            title="Lập phiếu thu quỹ"
          >
            <FilePlus className="w-4 h-4" />
            <span>+ Phiếu Thu</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-semibold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-rose-950/40 text-xs sm:text-sm"
            title="Lập phiếu chi quỹ"
          >
            <FileMinus className="w-4 h-4" />
            <span>- Phiếu Chi</span>
          </button>

          <button
            onClick={() => setIsAdminBankModalOpen(true)}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-700 text-xs"
            title="Cấu hình tài khoản nhận tiền QR-CODE"
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Cấu hình QR-CODE</span>
          </button>

          <button
            onClick={() => setIsCalcModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-700 text-xs sm:text-sm"
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Tính phí</span>
          </button>
        </div>
      </div>

      {/* Sub Tab Selection Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('DEBTS')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 ${
            subTab === 'DEBTS'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Bảng Công Nợ Thành Viên</span>
        </button>

        <button
          onClick={() => setSubTab('HISTORY')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 ${
            subTab === 'HISTORY'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lịch Sử Giao Dịch (Thu / Chi)</span>
        </button>
      </div>

      {/* Tab 1: Member Debts Table */}
      {subTab === 'DEBTS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-300">
              Bảng Công nợ Thành viên tháng <span className="font-mono text-emerald-400">{month}</span>
            </div>
            <button
              onClick={fetchDebts}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Đang tải dữ liệu công nợ...</div>
          ) : debts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Chưa có dữ liệu công nợ tháng {month}. Bấm "Tính phí" để tự động lập bảng phí.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Thành viên</th>
                    <th className="px-6 py-4">Loại TV</th>
                    <th className="px-6 py-4 text-right">Phải đóng (ROUNDUP)</th>
                    <th className="px-6 py-4 text-right">Đã đóng</th>
                    <th className="px-6 py-4 text-right">Còn thiếu</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {debts.map((d) => (
                    <tr key={d.member_id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                        <span>{d.member_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded font-bold border ${
                            d.member_type === 'FIXED'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {d.member_type === 'FIXED' ? 'Cố định' : 'Vãng lai'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-white">
                        {d.total_fee_required.toLocaleString()} đ
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-400">
                        {d.paid_amount.toLocaleString()} đ
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-400">
                        {d.remaining_amount.toLocaleString()} đ
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                            d.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : d.status === 'PAYMENT_REQUESTED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : d.status === 'PARTIAL'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {d.status === 'PAID'
                            ? 'Đã đóng'
                            : d.status === 'PAYMENT_REQUESTED'
                            ? '🔴 Chờ Admin xác nhận'
                            : d.status === 'PARTIAL'
                            ? 'Đóng 1 phần'
                            : 'Chưa đóng'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {d.remaining_amount > 0 && (
                          <>
                            <button
                              onClick={() => handleOpenQR(d)}
                              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg transition"
                            >
                              <QrCode className="w-3.5 h-3.5 inline mr-1" />
                              QR-CODE
                            </button>
                            <button
                              onClick={() => openPaymentModal(d)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                            >
                              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                              Nộp Tiền
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transaction History Table */}
      {subTab === 'HISTORY' && (
        <TransactionHistoryView monthKey={month} />
      )}

      {/* Calculate Fees Modal */}
      {isCalcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Tính Phí Tháng {month}</h2>

            <form onSubmit={handleCalculateFees} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phương pháp phân bổ Quỹ cố định</label>
                <select
                  value={calcMethod}
                  onChange={(e) => setCalcMethod(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="BY_REGISTERED_DAYS">Theo Số Ngày Đăng Ký (Phương pháp B)</option>
                  <option value="EQUAL_SPLIT">Chia Đều Cho Tất Cả Member (Phương pháp A)</option>
                  <option value="MANUAL">Thủ Công (Phương pháp C)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tổng chi phí Quỹ cố định cần chia (VNĐ)</label>
                <input
                  type="number"
                  step={1000}
                  value={totalCostToAllocate}
                  onChange={(e) => setTotalCostToAllocate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Đơn giá vãng lai / 1 lượt (VNĐ)</label>
                <input
                  type="number"
                  step={1000}
                  value={visitorPrice}
                  onChange={(e) => setVisitorPrice(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                Tất cả số tiền sau phân bổ sẽ được tự động **ROUNDUP lên hàng mười nghìn (ROUNDUP đến 10.000đ)**.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={calculating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition"
                >
                  {calculating ? 'Đang tính...' : 'Tính phí'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedMemberForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Ghi Nhận Đóng Tiền</h2>
            <p className="text-xs text-slate-400 mb-4">
              Thành viên: <strong className="text-white">{selectedMemberForPayment.member_name}</strong> - Tháng {month}
            </p>

            {paymentError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Công nợ còn thiếu:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {selectedMemberForPayment.remaining_amount.toLocaleString()} đ
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Số tiền nộp (VNĐ)</label>
                <input
                  type="number"
                  required
                  step={1000}
                  max={selectedMemberForPayment.remaining_amount}
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setPaymentAmount(val);
                    if (val > selectedMemberForPayment.remaining_amount) {
                      setPaymentError('Không cho phép đóng vượt quá số tiền còn thiếu (No Overpaid).');
                    } else {
                      setPaymentError(null);
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Hình thức</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Chuyển Khoản</option>
                    <option value="CASH">Tiền Mặt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ngày nộp</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Mã giao dịch / Ghi chú</label>
                <input
                  type="text"
                  value={bankTxCode}
                  onChange={(e) => setBankTxCode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Mã GD ngân hàng..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForPayment(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={paying || paymentAmount > selectedMemberForPayment.remaining_amount}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition disabled:opacity-50"
                >
                  {paying ? 'Đang lưu...' : 'Xác nhận Nộp Tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VietQR Modal */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-1">MÃ QR-CODE THANH TOÁN</h3>
            <p className="text-xs text-slate-400 mb-4">{qrModalMember} - Nợ còn thiếu</p>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mb-4">
              <img src={qrData.vietqr_url} alt="QR-CODE" className="w-56 h-56 mx-auto object-contain" />
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 text-left bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 mb-4">
              <div>
                Ngân hàng: <strong>{qrData.bank_name}</strong>
              </div>
              <div>
                Số tài khoản: <strong className="font-mono text-emerald-400">{qrData.account_number}</strong>
              </div>
              <div>
                Chủ tài khoản: <strong>{qrData.account_holder}</strong>
              </div>
              <div>
                Số tiền: <strong className="font-mono text-amber-400">{qrData.amount.toLocaleString()} đ</strong>
              </div>
              <div>
                Nội dung: <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px]">{qrData.description}</code>
              </div>
            </div>

            <button
              onClick={() => setQrData(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Admin VietQR Settings Modal */}
      <AdminPaymentSettingsModal
        isOpen={isAdminBankModalOpen}
        onClose={() => setIsAdminBankModalOpen(false)}
      />

      {/* Income Voucher Modal */}
      <IncomeVoucherModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        monthKey={month}
        onSuccess={() => {
          fetchDebts();
        }}
        onNavigateToDebts={() => {
          setSubTab('DEBTS');
        }}
      />

      {/* Expense Voucher Modal */}
      <ExpenseVoucherModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        monthKey={month}
        onSuccess={() => {
          fetchDebts();
        }}
      />
    </div>
  );
};
