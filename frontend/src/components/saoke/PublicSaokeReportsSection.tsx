import React, { useState, useEffect } from 'react';
import {
  getPublicFundPaymentsReport,
  getPublicExpensesReport,
  getPublicAttendanceReport,
  getPublicShuttleUsageReport
} from '../../api/saokeApi';
import { getCurrentMonthKey } from '../../utils/dateUtils';
import { BarChart3, Wallet, Receipt, Users, Box, Calendar, RefreshCw, Trophy, Inbox } from 'lucide-react';

export const PublicSaokeReportsSection: React.FC = () => {
  const currentMonthKey = getCurrentMonthKey();
  const currentYear = currentMonthKey.substring(0, 4);

  const [activeTab, setActiveTab] = useState<'fund' | 'expense' | 'attendance' | 'shuttle'>('fund');
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [periodType, setPeriodType] = useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('DAILY');

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const availableYears = ['2026', '2025', '2024'];
  const availableMonths = [
    '2026-12', '2026-11', '2026-10', '2026-09', '2026-08', '2026-07',
    '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01'
  ];

  const fetchReport = async () => {
    setLoading(true);
    try {
      let data = null;
      const params: any = filterMode === 'month' ? { month: selectedMonth } : { year: selectedYear };

      if (activeTab === 'fund') {
        data = await getPublicFundPaymentsReport(params);
      } else if (activeTab === 'expense') {
        data = await getPublicExpensesReport(params);
      } else if (activeTab === 'attendance') {
        data = await getPublicAttendanceReport(params);
      } else if (activeTab === 'shuttle') {
        data = await getPublicShuttleUsageReport({
          period_type: periodType,
          month: filterMode === 'month' ? selectedMonth : undefined,
          year: filterMode === 'year' ? selectedYear : undefined
        });
      }
      setReportData(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, filterMode, selectedMonth, selectedYear, periodType]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>THỐNG KÊ & BÁO CÁO CHI TIẾT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tổng hợp Thu Quỹ, Chi Phí, Buổi Chơi và Cầu Sử Dụng (Sắp xếp giảm dần)
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('fund')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'fund'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Đóng Quỹ</span>
          </button>

          <button
            onClick={() => setActiveTab('expense')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'expense'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Khoản Chi</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Buổi Chơi</span>
          </button>

          <button
            onClick={() => setActiveTab('shuttle')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'shuttle'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Quả Cầu</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setFilterMode('month')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                filterMode === 'month' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Theo Tháng
            </button>
            <button
              onClick={() => setFilterMode('year')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                filterMode === 'year' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Theo Năm
            </button>
          </div>

          {/* Selector */}
          {filterMode === 'month' ? (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Tháng {m.split('-')[1]}/{m.split('-')[0]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shuttle Usage Breakdown Type Selector */}
          {activeTab === 'shuttle' && (
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs text-amber-400 rounded-lg px-3 py-1.5 focus:outline-none font-bold"
            >
              <option value="DAILY">Chi tiết theo Ngày</option>
              <option value="MONTHLY">Chi tiết theo Tháng</option>
              <option value="YEARLY">Chi tiết theo Năm</option>
            </select>
          )}
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          title="Làm mới báo cáo"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-slate-950/60 rounded-xl border border-slate-800" />
          <div className="h-48 bg-slate-950/60 rounded-xl border border-slate-800" />
        </div>
      )}

      {/* Content & Tables */}
      {!loading && reportData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {activeTab === 'fund' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Tổng tiền đã thu</p>
                <p className="text-xl font-black text-emerald-400 mt-1 font-mono">
                  {reportData.summary?.total_collected?.toLocaleString('vi-VN')} đ
                </p>
              </div>
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Số thành viên đã đóng</p>
                <p className="text-xl font-black text-white mt-1">
                  {reportData.summary?.member_count || 0} người
                </p>
              </div>
            </div>
          )}

          {activeTab === 'expense' && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Tổng chi phí</p>
              <p className="text-xl font-black text-rose-400 mt-1 font-mono">
                {reportData.summary?.total_expense?.toLocaleString('vi-VN')} đ
              </p>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Tổng lượt tham gia</p>
                <p className="text-xl font-black text-blue-400 mt-1">
                  {reportData.summary?.total_player_sessions || 0} lượt
                </p>
              </div>
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Số thành viên tham gia</p>
                <p className="text-xl font-black text-white mt-1">
                  {reportData.summary?.total_unique_members || 0} người
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shuttle' && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Tổng quả cầu sử dụng</p>
              <p className="text-xl font-black text-amber-400 mt-1 font-mono">
                {reportData.summary?.formatted_total_display || '0 quả'}
              </p>
            </div>
          )}

          {/* Empty State Banner */}
          {(!reportData.items || reportData.items.length === 0) && (
            <div className="p-8 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center space-y-2">
              <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">Không có dữ liệu trong khoảng thời gian này.</p>
              <p className="text-xs text-slate-500">Thử thay đổi bộ lọc Tháng hoặc Năm để xem dữ liệu khác.</p>
            </div>
          )}

          {/* Data Tables */}
          {reportData.items && reportData.items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Hạng</th>
                    {activeTab === 'fund' && (
                      <>
                        <th className="py-3 px-4">Thành viên</th>
                        <th className="py-3 px-4">Loại</th>
                        <th className="py-3 px-4 text-right">Tổng đã đóng</th>
                      </>
                    )}
                    {activeTab === 'expense' && (
                      <>
                        <th className="py-3 px-4">Loại khoản chi</th>
                        <th className="py-3 px-4 text-center">Số giao dịch</th>
                        <th className="py-3 px-4 text-right">Tổng chi</th>
                      </>
                    )}
                    {activeTab === 'attendance' && (
                      <>
                        <th className="py-3 px-4">Thành viên</th>
                        <th className="py-3 px-4">Loại</th>
                        <th className="py-3 px-4 text-right">Số buổi tham gia</th>
                      </>
                    )}
                    {activeTab === 'shuttle' && (
                      <>
                        <th className="py-3 px-4">Thời gian</th>
                        <th className="py-3 px-4 text-right">Số quả cầu sử dụng</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {reportData.items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 text-center font-bold">
                        {idx === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs">
                            🥇
                          </span>
                        ) : idx === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 text-xs">
                            🥈
                          </span>
                        ) : idx === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40 text-xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">#{idx + 1}</span>
                        )}
                      </td>

                      {activeTab === 'fund' && (
                        <>
                          <td className="py-3 px-4 font-bold text-white">{item.full_name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.member_type === 'FIXED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {item.member_type === 'FIXED' ? 'CỐ ĐỊNH' : 'VÃNG LAI'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            {item.paid_amount?.toLocaleString('vi-VN')} đ
                          </td>
                        </>
                      )}

                      {activeTab === 'expense' && (
                        <>
                          <td className="py-3 px-4 font-bold text-white">{item.category_name}</td>
                          <td className="py-3 px-4 text-center font-mono">{item.transaction_count}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            {item.total_amount?.toLocaleString('vi-VN')} đ
                          </td>
                        </>
                      )}

                      {activeTab === 'attendance' && (
                        <>
                          <td className="py-3 px-4 font-bold text-white">{item.full_name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.member_type === 'FIXED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {item.member_type === 'FIXED' ? 'CỐ ĐỊNH' : 'VÃNG LAI'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-400">
                            {item.session_count} buổi
                          </td>
                        </>
                      )}

                      {activeTab === 'shuttle' && (
                        <>
                          <td className="py-3 px-4 font-bold text-white">{item.period_label}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                            {item.formatted_display}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
