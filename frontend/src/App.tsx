import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { MembersPage } from './pages/MembersPage';
import { SessionsPage } from './pages/SessionsPage';
import { FeesAndDebtsPage } from './pages/FeesAndDebtsPage';
import { InventoryPage } from './pages/InventoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { PublicSaokePage } from './pages/PublicSaokePage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { apiClient } from './api/client';
import { Users, CreditCard, Package, LogOut, Activity, LayoutDashboard, Calendar, Eye, Settings } from 'lucide-react';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'sessions' | 'inventory' | 'fees' | 'settings'>('dashboard');

  const isSaokePath = typeof window !== 'undefined' && (window.location.pathname === '/saoke' || window.location.pathname.startsWith('/saoke'));

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data.data.user);
          setToken(storedToken);
        } catch (err) {
          localStorage.removeItem('access_token');
          setToken(null);
          setUser(null);
        }
      }
      setInitializing(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  // Public Route /saoke - Render immediately without login check
  if (isSaokePath) {
    return <PublicSaokePage />;
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Đang khởi động ứng dụng Quỹ Cầu Lông 5AM...
      </div>
    );
  }

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-white text-lg leading-none">QUY 5AM</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">RISE & SHINE - V3.1</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Thành viên</span>
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`group px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'sessions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className={`w-4 h-4 transition-colors ${
                activeTab === 'sessions' ? 'text-white' : 'text-emerald-400 group-hover:text-emerald-300'
              }`} />
              <span>Lịch chơi & Điểm danh</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Tồn kho</span>
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'fees'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Quỹ & Công nợ</span>
            </button>

            {/* Admin Settings Button */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title="Cài đặt hệ thống Admin"
            >
              <Settings className="w-4 h-4" />
              <span>⚙ Cài đặt Admin</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/saoke"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Mở trang sao kê công khai trong tab mới"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Trang Sao Kê</span>
            </a>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main View */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' ? (
          <DashboardPage />
        ) : activeTab === 'members' ? (
          <MembersPage onLogout={handleLogout} />
        ) : activeTab === 'sessions' ? (
          <SessionsPage />
        ) : activeTab === 'inventory' ? (
          <InventoryPage />
        ) : activeTab === 'fees' ? (
          <FeesAndDebtsPage />
        ) : (
          <AdminSettingsPage />
        )}
      </main>
    </div>
  );
};

export default App;
