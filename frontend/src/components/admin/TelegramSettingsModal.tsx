import React, { useState, useEffect } from 'react';
import { getTelegramSettings, updateTelegramSettings, testTelegram, AdminTelegramSettingsDTO } from '../../api/telegramApi';
import { Send, Key, MessageSquare, Check, AlertCircle, X, Shield, RefreshCw } from 'lucide-react';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AdminTelegramSettingsDTO | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    getTelegramSettings()
      .then((data) => {
        setSettings(data);
        setEnabled(data.enabled);
        setChatId(data.chatId || '');
        setBotToken(''); // Always clear token input field
      })
      .catch((err: any) => {
        console.error('Failed to load Telegram settings:', err);
        setError(err.response?.data?.error?.message || 'Lỗi khi tải cấu hình Telegram.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await updateTelegramSettings({
        enabled,
        botToken: botToken.trim() ? botToken.trim() : undefined,
        chatId: chatId.trim()
      });
      setSettings(updated);
      setBotToken('');
      setSuccessMsg('Đã lưu cấu hình Telegram Bot thành công.');
    } catch (err: any) {
      console.error('Failed to save Telegram settings:', err);
      setError(err.response?.data?.error?.message || 'Lỗi khi lưu cấu hình Telegram Bot.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await testTelegram();
      setSuccessMsg(res.message || 'Gửi tin nhắn kiểm tra thành công!');
    } catch (err: any) {
      console.error('Failed to test Telegram notification:', err);
      setError(err.response?.data?.error?.message || 'Gửi tin nhắn kiểm tra thất bại.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cấu hình Telegram Notification Bot</h2>
              <p className="text-xs text-slate-400">Nhận thông báo chuyển khoản tức thì từ trang Public /saoke</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-10 text-center space-y-3">
            <div className="w-7 h-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Đang tải cấu hình Telegram...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Enable/Disable Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div>
                <p className="text-xs font-bold text-white">Bật thông báo Telegram</p>
                <p className="text-[11px] text-slate-400">Tự động gửi alert khi người dùng bấm CÓ trên QR-CODE modal</p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Bot Token Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Telegram Bot API Token</span>
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={settings?.hasBotToken ? '•••••••••••••••••••• (Đã cấu hình)' : 'Nhập Bot Token mới (VD: 123456789:ABC...)'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
              {settings?.hasBotToken && !botToken && (
                <p className="text-[11px] text-slate-400">
                  Bot Token đã được lưu an toàn trên Server. (Để trống nếu giữ nguyên).
                </p>
              )}
            </div>

            {/* Chat ID Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Telegram Chat ID / Group ID</span>
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="VD: -100123456789 hoặc ID cá nhân"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {/* Security Isolation Notice */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-start gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Bot Token và Chat ID được lưu giữ hoàn toàn phía <strong>Server-side</strong> và bảo mật tuyệt đối. Frontend không bao giờ tiếp cận được Bot Token.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !enabled || (!settings?.hasBotToken && !botToken) || !chatId}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-sky-400" />}
                <span>Kiểm tra kết nối</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950/40 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu cấu hình</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
