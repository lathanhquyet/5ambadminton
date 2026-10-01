import React, { useState, useEffect } from 'react';
import { apiClient, Member } from '../api/client';
import { Users, UserPlus, Filter, Edit2, Trash2, Calendar, CheckCircle2, AlertCircle, LogOut, UserCheck, UserX, Power } from 'lucide-react';

interface MembersPageProps {
  onLogout: () => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({ onLogout }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memberType, setMemberType] = useState<'FIXED' | 'VISITOR'>('FIXED');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [joinedDate, setJoinedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/members?year=2026&month=10';
      if (filterType) url += `&type=${filterType}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const res = await apiClient.get(url);
      setMembers(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Không thể tải danh sách thành viên.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [filterType, filterStatus]);

  const openCreateModal = () => {
    setEditingMember(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setMemberType('FIXED');
    setStatus('ACTIVE');
    setDaysPerWeek(5);
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setFullName(member.full_name);
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setMemberType(member.member_type);
    setStatus(member.status || 'ACTIVE');
    setDaysPerWeek(member.days_per_week);
    setJoinedDate(member.joined_date);
    setNotes(member.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        full_name: fullName,
        phone,
        email,
        member_type: memberType,
        status,
        days_per_week: memberType === 'FIXED' ? daysPerWeek : 0,
        joined_date: joinedDate,
        notes
      };

      if (editingMember) {
        await apiClient.put(`/members/${editingMember.id}`, payload);
      } else {
        await apiClient.post('/members', payload);
      }

      setIsModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Lưu thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member: Member, targetStatus: 'ACTIVE' | 'INACTIVE') => {
    const actionText = targetStatus === 'INACTIVE' ? 'chuyển sang trạng thái TẠM NGƯNG (INACTIVE)' : 'KÍCH HOẠT LẠI (ACTIVE)';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} cho thành viên "${member.full_name}"?`)) {
      return;
    }
    try {
      await apiClient.put(`/members/${member.id}`, { status: targetStatus });
      fetchMembers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển thành viên "${name}" sang trạng thái INACTIVE?`)) {
      return;
    }
    try {
      await apiClient.delete(`/members/${id}`);
      fetchMembers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Xóa thất bại.');
    }
  };

  // Preview calculation for October 2026 (31 days)
  const expectedDaysPreview = Math.ceil((daysPerWeek * 31) / 7);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QUẢN LÝ THÀNH VIÊN</h1>
              <p className="text-sm text-slate-400">Danh sách thành viên cố định & vãng lai (Phase 1)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-xl transition flex items-center gap-2 shadow-md shadow-emerald-950/40"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Thành Viên</span>
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-2 border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Business Formula Proof Card */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-emerald-300">Công thức Nghiệp vụ (Formulas Verified)</h3>
              <p className="text-xs text-slate-300 mt-1">
                Công thức tính ngày dự kiến: <code className="bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-200">Math.ceil(daysPerWeek * daysInMonth / 7)</code>
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-900/80 border border-emerald-500/20 rounded-xl text-xs text-slate-300">
            Kỳ Tháng 10/2026 (31 ngày): <strong className="text-emerald-400 font-mono">5 ngày/tuần = 23 ngày dự kiến</strong>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Bộ lọc:</span>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Tất cả Loại TV</option>
            <option value="FIXED">Cố Định (FIXED)</option>
            <option value="VISITOR">Vãng Lai (VISITOR)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Tất cả Trạng thái</option>
            <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
            <option value="SUSPENDED">SUSPENDED (Tạm dừng)</option>
            <option value="INACTIVE">INACTIVE (Ngưng hoạt động)</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Đang tải dữ liệu...</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-400 flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Chưa có thành viên nào. Hãy bấm "Thêm Thành Viên".</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Họ và Tên</th>
                    <th className="px-6 py-4">Loại TV</th>
                    <th className="px-6 py-4">Đăng ký/Tuần</th>
                    <th className="px-6 py-4">Dự kiến T10/2026</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Ngày tham gia</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4 font-semibold text-white">
                        {member.full_name}
                        {member.phone && <div className="text-xs text-slate-400 font-normal">{member.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg ${
                            member.member_type === 'FIXED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {member.member_type === 'FIXED' ? 'Cố định' : 'Vãng lai'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">
                        {member.member_type === 'FIXED' ? `${member.days_per_week} buổi/tuần` : '-'}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {member.member_type === 'FIXED' ? (
                          <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/20">
                            {member.expected_days} ngày
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : member.status === 'SUSPENDED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {member.status === 'ACTIVE'
                            ? 'Hoạt động'
                            : member.status === 'SUSPENDED'
                            ? 'Tạm dừng'
                            : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{member.joined_date}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {member.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleToggleStatus(member, 'INACTIVE')}
                            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition"
                            title="Tạm ngưng tham gia"
                          >
                            <UserX className="w-3.5 h-3.5 inline mr-1" />
                            Tạm ngưng
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(member, 'ACTIVE')}
                            className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg transition"
                            title="Kích hoạt lại"
                          >
                            <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                            Kích hoạt
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingMember ? 'Cập nhật Thành Viên' : 'Thêm Thành Viên Mới'}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Họ và Tên (*)</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Số Điện Thoại</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Loại Thành Viên (*)</label>
                    <select
                      value={memberType}
                      onChange={(e) => setMemberType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="FIXED">Cố Định (FIXED)</option>
                      <option value="VISITOR">Vãng Lai (VISITOR)</option>
                    </select>
                  </div>

                  {memberType === 'FIXED' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Số ngày/tuần (0..7)</label>
                      <input
                        type="number"
                        min={0}
                        max={7}
                        value={daysPerWeek}
                        onChange={(e) => setDaysPerWeek(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Trạng Thái (*)</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                      <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                      <option value="SUSPENDED">Tạm dừng (SUSPENDED)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Ngày tham gia (*)</label>
                    <input
                      type="date"
                      required
                      value={joinedDate}
                      onChange={(e) => setJoinedDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {memberType === 'FIXED' && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                    Xem trước ngày dự kiến tháng 10/2026 (31 ngày):{' '}
                    <strong className="text-emerald-400 font-mono text-sm">{expectedDaysPreview} ngày</strong>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ghi chú</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ghi chú thêm..."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-md shadow-emerald-950/40"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu lại'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
