import React, { useState, useEffect } from 'react';
import { getTransactionHistory, TransactionHistoryItem, TransactionHistoryResponse } from '../../api/transactionApi';
import { History, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownLeft, Calendar, FileText, User } from 'lucide-react';

interface TransactionHistoryViewProps {
  monthKey: string;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({ monthKey }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [data, setData] = useState<TransactionHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTransactionHistory({
        month: selectedMonth || undefined,
        type: typeFilter,
        category: categoryFilter,
        search: searchTerm,
        page,
        limit: 20
      });
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Không thể tải lịch sử giao dịch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedMonth, typeFilter, categoryFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>Lịch sử Giao dịch Sổ quỹ</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Danh sách hợp nhất tất cả các phiếu thu và phiếu chi trong hệ thống
          </p>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Month Selector */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
          />

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tất cả loại (Thu & Chi)</option>
            <option value="INCOME">Chỉ Giao dịch THU</option>
            <option value="EXPENSE">Chỉ Giao dịch CHI</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tất cả danh mục</option>
            <option value="FIXED_FUND">Phí thành viên</option>
            <option value="VISITOR_FEE">Phí vãng lai</option>
            <option value="OTHER_INCOME">Thu khác</option>
            <option value="COURT_FEE">Phí sân</option>
            <option value="SHUTTLE_PURCHASE">Mua cầu</option>
            <option value="OTHER_EXPENSE">Chi khác</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm nội dung, người nộp/nhận..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </form>
      </div>

      {/* Summary Stat Bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          <div>
            <span className="text-slate-400 block">Tổng giao dịch:</span>
            <span className="font-bold text-white text-sm">{data.pagination.totalItems}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Tổng Thu (Theo lọc):</span>
            <span className="font-bold text-emerald-400 text-sm font-mono">
              +{data.summary.totalIncome.toLocaleString()} ₫
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Tổng Chi (Theo lọc):</span>
            <span className="font-bold text-rose-400 text-sm font-mono">
              -{data.summary.totalExpense.toLocaleString()} ₫
            </span>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
            <tr>
              <th className="p-3">Ngày</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Nhóm giao dịch</th>
              <th className="p-3">Nội dung / Diễn giải</th>
              <th className="p-3">Người nộp / Nhận</th>
              <th className="p-3 text-right">Khoản Thu</th>
              <th className="p-3 text-right">Khoản Chi</th>
              <th className="p-3 text-center">Người tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Đang tải lịch sử giao dịch...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-rose-400">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Không tìm thấy giao dịch nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}

            {!loading && !error && data && data.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{item.date}</td>
                <td className="p-3 whitespace-nowrap">
                  {item.type === 'INCOME' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1">
                      <ArrowDownLeft className="w-3 h-3" /> THU
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 gap-1">
                      <ArrowUpRight className="w-3 h-3" /> CHI
                    </span>
                  )}
                </td>
                <td className="p-3 font-medium text-white whitespace-nowrap">{item.categoryLabel}</td>
                <td className="p-3 text-slate-200 max-w-xs truncate" title={item.description}>
                  {item.description}
                </td>
                <td className="p-3 text-slate-300 font-medium whitespace-nowrap">
                  {item.payerOrRecipient}
                </td>
                <td className="p-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                  {item.incomeAmount > 0 ? `+${item.incomeAmount.toLocaleString()} ₫` : '-'}
                </td>
                <td className="p-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                  {item.expenseAmount > 0 ? `-${item.expenseAmount.toLocaleString()} ₫` : '-'}
                </td>
                <td className="p-3 text-center text-slate-400 whitespace-nowrap">
                  {item.createdBy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <span>
            Hiển thị trang {data.pagination.page} / {data.pagination.totalPages} ({data.pagination.totalItems} giao dịch)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              Trang trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
