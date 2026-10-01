import React, { useState, useEffect } from 'react';
import { getAdminPaymentSettings, updateAdminPaymentSettings, PaymentSettingsDTO } from '../api/paymentApi';
import { Building2, Save, X, QrCode, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AdminPaymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_BANKS = [
  { name: 'MB', bin: '970422', label: 'MBBank (Ngân hàng Quân Đội)' },
  { name: 'Vietcombank', bin: '970436', label: 'Vietcombank (VCB)' },
  { name: 'Techcombank', bin: '970407', label: 'Techcombank (TCB)' },
  { name: 'BIDV', bin: '970418', label: 'BIDV' },
  { name: 'VietinBank', bin: '970415', label: 'VietinBank' },
  { name: 'Agribank', bin: '970405', label: 'Agribank' },
  { name: 'VPBank', bin: '970432', label: 'VPBank' },
  { name: 'TPBank', bin: '970423', label: 'TPBank' },
  { name: 'ACB', bin: '970416', label: 'ACB' },
  { name: 'Sacombank', bin: '970403', label: 'Sacombank' }
];

export const AdminPaymentSettingsModal: React.FC<AdminPaymentSettingsModalProps> = ({ isOpen, onClose }) => {
  const [bankName, setBankName] = useState<string>('MB');
  const [bankBin, setBankBin] = useState<string>('970436');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testQrUrl, setTestQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setTestQrUrl(null);

    getAdminPaymentSettings()
      .then((settings) => {
        setBankName(settings.bankName || 'MB');
        setBankBin(settings.bankBin || '970436');
        setAccountNumber(settings.accountNumber || '');
        setAccountName(settings.accountName || '');
        setEnabled(settings.enabled !== false);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err.response?.data?.error?.message || 'Không thể tải cấu hình tài khoản nhận tiền.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  const handleBankChange = (selectedName: string) => {
    setBankName(selectedName);
    const found = COMMON_BANKS.find((b) => b.name === selectedName);
    if (found) {
      setBankBin(found.bin);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await updateAdminPaymentSettings({
        enabled,
        bankName,
        bankBin,
        accountNumber,
        accountName
      });

      setSuccessMsg('Đã lưu cấu hình tài khoản nhận tiền QR-CODE thành công.');
      setBankName(updated.bankName);
      setBankBin(updated.bankBin);
      setAccountNumber(updated.accountNumber);
      setAccountName(updated.accountName);
      setEnabled(updated.enabled);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Không thể lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestQr = () => {
    if (!bankName || !accountNumber || !accountName) {
      setError('Vui lòng điền đầy đủ thông tin tài khoản trước khi thử nghiệm QR.');
      return;
    }
    const testAmount = 50000;
    const testRef = '5AM-TEST-QR-001';
    const url = `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact.png?amount=${testAmount}&addInfo=${encodeURIComponent(testRef)}`;
    setTestQrUrl(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cấu hình Tài khoản QR-CODE</h3>
              <p className="text-xs text-slate-400">Tài khoản nhận tiền thanh toán cho Quỹ Cầu Lông 5AM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Đang tải cấu hình hiện tại...</p>
          </div>
        )}

        {/* Form Content */}
        {!loading && (
          <form onSubmit={handleSave} className="space-y-4">
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

            {/* Enabled Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-white block">Kích hoạt QR-CODE</span>
                <span className="text-[11px] text-slate-400">Cho phép tạo QR thanh toán công khai</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Bank Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ngân hàng nhận tiền:</label>
              <select
                value={bankName}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
              >
                {COMMON_BANKS.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bank BIN */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mã BIN Ngân hàng:</label>
                <input
                  type="text"
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                  placeholder="970436"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Số tài khoản (STK):</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Ví dụ: 090123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tên chủ tài khoản (Viết hoa không dấu):</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                placeholder="QUY CAU LONG 5AM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition uppercase font-semibold"
                required
              />
            </div>

            {/* Test QR Preview Panel */}
            {testQrUrl && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-2 animate-fadeIn">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">Mã QR Kiểm Tra (Test QR)</span>
                <img src={testQrUrl} alt="Test QR Code" className="w-40 h-40 mx-auto rounded-lg bg-white p-2 border border-slate-700" />
                <p className="text-[10px] text-amber-400">QR kiểm tra dùng để xác minh hiển thị, không ghi nhận giao dịch tài chính nào.</p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleTestQr}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Thử QR</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40 inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
