import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { getAdminPaymentSettings, updateAdminPaymentSettings, PaymentSettingsDTO } from '../api/paymentApi';
import { getTelegramSettings, updateTelegramSettings, testTelegram, AdminTelegramSettingsDTO } from '../api/telegramApi';
import { User, Key, Building2, Send, Check, AlertCircle, RefreshCw, Shield, Lock, CreditCard } from 'lucide-react';

interface AdminProfileDTO {
  id: string;
  username: string;
  role: string;
  fullName: string;
  email: string;
  phone: string;
}

export const AdminSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'vietqr' | 'telegram'>('profile');

  // Section A: Admin Profile State
  const [profile, setProfile] = useState<AdminProfileDTO | null>(null);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section B: Change Password State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordSaving, setPasswordSaving] = useState<boolean>(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section C: VietQR Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettingsDTO | null>(null);
  const [bankName, setBankName] = useState<string>('');
  const [bankBin, setBankBin] = useState<string>('970436');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [paymentEnabled, setPaymentEnabled] = useState<boolean>(true);
  const [paymentSaving, setPaymentSaving] = useState<boolean>(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section D: Telegram Bot Settings State
  const [telegramSettings, setTelegramSettings] = useState<AdminTelegramSettingsDTO | null>(null);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(false);
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [telegramSaving, setTelegramSaving] = useState<boolean>(false);
  const [telegramTesting, setTelegramTesting] = useState<boolean>(false);
  const [telegramMsg, setTelegramMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load all configurations
  useEffect(() => {
    let isMounted = true;
    setProfileLoading(true);

    Promise.all([
      apiClient.get('/auth/profile').then(res => res.data.data).catch(() => null),
      getAdminPaymentSettings().catch(() => null),
      getTelegramSettings().catch(() => null)
    ]).then(([profileData, bankData, tgData]) => {
      if (!isMounted) return;
      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.fullName || '');
        setEmail(profileData.email || '');
        setPhone(profileData.phone || '');
      }
      if (bankData) {
        setPaymentSettings(bankData);
        setPaymentEnabled(bankData.enabled);
        setBankName(bankData.bankName || 'MB');
        setBankBin(bankData.bankBin || '970436');
        setAccountNumber(bankData.accountNumber || '');
        setAccountName(bankData.accountName || '');
      }
      if (tgData) {
        setTelegramSettings(tgData);
        setTelegramEnabled(tgData.enabled);
        setChatId(tgData.chatId || '');
      }
    }).finally(() => {
      if (isMounted) setProfileLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await apiClient.put('/auth/profile', { fullName, email, phone });
      setProfile(res.data.data);
      setProfileMsg({ type: 'success', text: 'Cập nhật thông tin hồ sơ Admin thành công.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error?.message || 'Lỗi khi cập nhật hồ sơ.' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const res = await apiClient.put('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: res.data.message || 'Đổi mật khẩu thành công.' });
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.error?.message || 'Lỗi khi đổi mật khẩu.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  // Save VietQR Payment Settings Handler
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentMsg(null);
    try {
      const updated = await updateAdminPaymentSettings({
        enabled: paymentEnabled,
        bankName,
        bankBin,
        accountNumber,
        accountName
      });
      setPaymentSettings(updated);
      setPaymentMsg({ type: 'success', text: 'Đã lưu cấu hình nhận tiền QR-CODE thành công.' });
    } catch (err: any) {
      setPaymentMsg({ type: 'error', text: err.response?.data?.error?.message || 'Lỗi khi lưu cấu hình QR-CODE.' });
    } finally {
      setPaymentSaving(false);
    }
  };

  // Save Telegram Settings Handler
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramSaving(true);
    setTelegramMsg(null);
    try {
      const updated = await updateTelegramSettings({
        enabled: telegramEnabled,
        botToken: botToken.trim() ? botToken.trim() : undefined,
        chatId: chatId.trim()
      });
      setTelegramSettings(updated);
      setBotToken('');
      setTelegramMsg({ type: 'success', text: 'Đã lưu cấu hình Telegram Bot thành công.' });
    } catch (err: any) {
      setTelegramMsg({ type: 'error', text: err.response?.data?.error?.message || 'Lỗi khi lưu cấu hình Telegram Bot.' });
    } finally {
      setTelegramSaving(false);
    }
  };

  // Test Telegram Handler
  const handleTestTelegram = async () => {
    setTelegramTesting(true);
    setTelegramMsg(null);
    try {
      const res = await testTelegram();
      setTelegramMsg({ type: 'success', text: res.message || 'Gửi tin nhắn kiểm tra Telegram thành công!' });
    } catch (err: any) {
      setTelegramMsg({ type: 'error', text: err.response?.data?.error?.message || 'Gửi tin nhắn kiểm tra thất bại.' });
    } finally {
      setTelegramTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚙ CÀI ĐẶT QUẢN TRỊ VIÊN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý hồ sơ Admin, Đổi mật khẩu, Cấu hình tài khoản nhận tiền QR-CODE & Telegram Alert Bot
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>👤 TÀI KHOẢN ADMIN</span>
        </button>

        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'password'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>🔐 ĐỔI MẬT KHẨU</span>
        </button>

        <button
          onClick={() => setActiveTab('vietqr')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'vietqr'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>💳 NHẬN TIỀN / QR-CODE</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'telegram'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>🤖 TELEGRAM BOT</span>
        </button>
      </div>

      {profileLoading && (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Đang tải thông tin cấu hình Admin...</p>
        </div>
      )}

      {!profileLoading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Section A: Admin Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5 max-w-lg">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <span>👤 Thông tin Hồ sơ Admin</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Cập nhật thông tin cá nhân hiển thị của Quản trị viên</p>
              </div>

              {profileMsg && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  profileMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}>
                  {profileMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.username || 'admin'}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Quyền hạn (Role)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={profile?.role || 'ADMIN'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-bold cursor-not-allowed uppercase"
                  />
                  <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Không thể thay đổi
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Họ và Tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên Admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@5ambadminton.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 flex items-center gap-2"
              >
                {profileSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Lưu thông tin hồ sơ</span>
              </button>
            </form>
          )}

          {/* Section B: Change Password */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-5 max-w-lg">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  <span>🔐 Đổi mật khẩu Quản trị viên</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Bảo vệ tài khoản quản trị bằng mật khẩu mạnh</p>
              </div>

              {passwordMsg && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}>
                  {passwordMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={passwordSaving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 flex items-center gap-2"
              >
                {passwordSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Đổi mật khẩu</span>
              </button>
            </form>
          )}

          {/* Section C: QR-CODE Payment Settings */}
          {activeTab === 'vietqr' && (
            <form onSubmit={handleSavePayment} className="space-y-5 max-w-lg">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span>💳 Cấu hình Tài khoản Nhận tiền QR-CODE</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Tài khoản chính thức hiển thị trên trang Public /saoke để thành viên quét mã QR-CODE</p>
              </div>

              {paymentMsg && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  paymentMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}>
                  {paymentMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{paymentMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-white">Bật tính năng QR-CODE</p>
                  <p className="text-[11px] text-slate-400">Hiển thị mục QR-CODE trên trang công khai</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentEnabled(!paymentEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    paymentEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    paymentEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Tên ngân hàng (Bank Name)</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="VD: MBBank, Vietcombank, Techcombank"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Mã BIN Ngân hàng (Bank BIN)</label>
                <input
                  type="text"
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                  placeholder="VD: 970422 (MB), 970436 (VCB)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Số tài khoản nhận tiền</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="090123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Tên chủ tài khoản</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="QUY CAU LONG 5AM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={paymentSaving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 flex items-center gap-2"
              >
                {paymentSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Lưu cấu hình QR-CODE</span>
              </button>
            </form>
          )}

          {/* Section D: Telegram Bot Settings */}
          {activeTab === 'telegram' && (
            <form onSubmit={handleSaveTelegram} className="space-y-5 max-w-lg">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-400" />
                  <span>🤖 Cấu hình Telegram Alert Bot</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Tự động gửi thông báo đến Telegram khi thành viên xác nhận chuyển khoản trên /saoke</p>
              </div>

              {telegramMsg && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  telegramMsg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}>
                  {telegramMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{telegramMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-white">Bật thông báo Telegram</p>
                  <p className="text-[11px] text-slate-400">Tự động gửi tin nhắn alert về Telegram Group/Chat</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTelegramEnabled(!telegramEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    telegramEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    telegramEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Telegram Bot API Token</span>
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={telegramSettings?.hasBotToken ? '•••••••••••••••••••• (Đã lưu an toàn)' : 'Nhập Bot Token mới (VD: 123456789:ABC...)'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                {telegramSettings?.hasBotToken && !botToken && (
                  <p className="text-[11px] text-slate-400">
                    Bot Token đã được lưu giữ an toàn phía <strong className="text-emerald-400">Server-side</strong> (0 exposure).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Telegram Chat ID / Group ID</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="VD: -100123456789 hoặc User ID"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Bot Token và Chat ID được lưu trữ hoàn toàn phía <strong>Server-side</strong>. Frontend tuyệt đối không tiếp cận được Bot Token.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-3">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={telegramTesting || !telegramEnabled || (!telegramSettings?.hasBotToken && !botToken) || !chatId}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {telegramTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Kiểm tra kết nối Telegram</span>
                </button>

                <button
                  type="submit"
                  disabled={telegramSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {telegramSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu cấu hình Bot</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
