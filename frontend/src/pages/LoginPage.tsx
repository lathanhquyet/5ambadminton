import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { ShieldAlert, LogIn, Activity } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/auth/login', { username, password });
      const { access_token, user } = response.data.data;
      localStorage.setItem('access_token', access_token);
      onLoginSuccess(access_token, user);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">QUỸ CẦU LÔNG 5AM</h1>
          <p className="text-sm text-slate-400 mt-1">Hệ thống Quản lý Quỹ & Thành viên (V3.1)</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Tên đăng nhập
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="Nhập username..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="Nhập password..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Đăng nhập Admin</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
          Tài khoản mặc định: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">admin</code> / <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">admin123</code>
        </div>
      </div>
    </div>
  );
};
