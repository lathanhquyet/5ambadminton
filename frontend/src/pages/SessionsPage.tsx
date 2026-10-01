import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { getCurrentMonthKey, getCurrentDateStr } from '../utils/dateUtils';
import { Calendar, Plus, CheckSquare, Square, Package, Ban, Layers, Search, UserPlus, DollarSign, Trash2, Lock, CheckCircle2 } from 'lucide-react';

interface SessionMember {
  id: string;
  member_id: string;
  full_name: string;
  member_type: 'FIXED' | 'VISITOR';
  attendance_status: 'PRESENT' | 'ABSENT';
  visitor_fee_id?: string;
  visitor_fee_amount?: number;
  visitor_fee_status?: 'UNPAID' | 'PAID';
  visitor_income_tx_id?: string;
}

interface PlayingSession {
  id: string;
  session_date: string;
  month_key: string;
  status: 'PLANNED' | 'OPEN' | 'COMPLETED' | 'CANCELLED';
  total_players: number;
  shuttle_used: number;
  notes?: string;
  attendance: SessionMember[];
}

interface InventorySummary {
  total_pieces: number;
  tubes_formatted: string;
}

export const SessionsPage: React.FC = () => {
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [sessions, setSessions] = useState<PlayingSession[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Create Session Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(getCurrentDateStr());
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Visitor in Create Modal
  const [includeVisitor, setIncludeVisitor] = useState(false);
  const [selectedVisitorMemberId, setSelectedVisitorMemberId] = useState<string>('');
  const [visitorNameInput, setVisitorNameInput] = useState('');
  const [visitorAmountInput, setVisitorAmountInput] = useState<number>(50000);
  const [visitorPaidInput, setVisitorPaidInput] = useState(false);

  // Inline Add Visitor Modal for Existing Session
  const [addingVisitorSessionId, setAddingVisitorSessionId] = useState<string | null>(null);

  // Shuttle Usage Inline Edit State
  const [editingShuttleSessionId, setEditingShuttleSessionId] = useState<string | null>(null);
  const [shuttleInputValue, setShuttleInputValue] = useState<number>(0);

  // Editable Visitor Fee Amount State
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState<number>(50000);

  // Local Draft Attendance State for Bulk Edit
  const [draftAttendance, setDraftAttendance] = useState<Record<string, Record<string, 'PRESENT' | 'ABSENT'>>>({});
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  const isSessionLocked = (sessionDateStr: string, currentDateStr?: string): boolean => {
    const today = currentDateStr || new Date().toISOString().split('T')[0];
    const sDate = new Date(sessionDateStr + 'T00:00:00Z');
    const lockDate = new Date(sDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const lockDateStr = lockDate.toISOString().split('T')[0];
    return today >= lockDateStr;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, membersRes, stockRes] = await Promise.all([
        apiClient.get(`/sessions?month=${month}`),
        apiClient.get('/members?status=ACTIVE'),
        apiClient.get('/inventory/summary')
      ]);

      const fetchedSessions: PlayingSession[] = sessionsRes.data.data;
      setSessions(fetchedSessions);
      setMembers(membersRes.data.data);
      setStockSummary(stockRes.data.data);

      const initDrafts: Record<string, Record<string, 'PRESENT' | 'ABSENT'>> = {};
      fetchedSessions.forEach((session) => {
        const sessionMap: Record<string, 'PRESENT' | 'ABSENT'> = {};
        session.attendance.forEach((a) => {
          sessionMap[a.member_id] = a.attendance_status;
        });
        initDrafts[session.id] = sessionMap;
      });
      setDraftAttendance(initDrafts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  const handleOpenCreateModal = () => {
    const fixedIds = members.filter((m) => m.member_type === 'FIXED').map((m) => m.id);
    setSelectedMemberIds(fixedIds);
    setMemberSearchTerm('');
    setIncludeVisitor(false);
    setSelectedVisitorMemberId('');
    setVisitorNameInput('');
    setVisitorAmountInput(50000);
    setVisitorPaidInput(false);
    setIsCreateModalOpen(true);
  };

  const handleToggleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSelectAllFixed = () => {
    const fixedIds = members.filter((m) => m.member_type === 'FIXED').map((m) => m.id);
    setSelectedMemberIds(fixedIds);
  };

  const handleDeselectAll = () => {
    setSelectedMemberIds([]);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        session_date: newSessionDate,
        notes: newSessionNotes,
        member_ids: selectedMemberIds
      };

      if (includeVisitor) {
        if (selectedVisitorMemberId) {
          payload.visitor = {
            member_id: selectedVisitorMemberId,
            amount: visitorAmountInput,
            is_paid: false
          };
        } else if (visitorNameInput.trim()) {
          payload.visitor = {
            full_name: visitorNameInput.trim(),
            amount: visitorAmountInput,
            is_paid: false
          };
        }
      }

      await apiClient.post('/sessions', payload);
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Tạo buổi chơi thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVisitorToSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingVisitorSessionId) return;

    try {
      const payload: any = {
        amount: visitorAmountInput,
        is_paid: false
      };

      if (selectedVisitorMemberId) {
        payload.member_id = selectedVisitorMemberId;
      } else if (visitorNameInput.trim()) {
        payload.full_name = visitorNameInput.trim();
      } else {
        alert('Vui lòng chọn hoặc nhập tên thành viên vãng lai.');
        return;
      }

      await apiClient.post(`/sessions/${addingVisitorSessionId}/visitors`, payload);
      setAddingVisitorSessionId(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Thêm khách vãng lai thất bại.');
    }
  };

  const handleUpdateVisitorFeeAmount = async (feeId: string) => {
    try {
      await apiClient.put(`/sessions/visitor-fees/${feeId}`, {
        amount: editingFeeValue
      });
      setEditingFeeId(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Cập nhật phí vãng lai thất bại.');
    }
  };

  const handleMarkVisitorPaid = async (feeId: string) => {
    try {
      await apiClient.post(`/sessions/visitor-fees/${feeId}/pay`, {
        payment_method: 'CASH'
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Ghi nhận đóng tiền thất bại.');
    }
  };

  const handleRemoveVisitor = async (sessionId: string, memberId: string, isPaid?: boolean) => {
    if (isPaid) {
      alert('Không thể xóa thành viên vãng lai đã thanh toán (PAID) khỏi buổi chơi.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa khách vãng lai này khỏi buổi chơi?')) {
      return;
    }

    try {
      await apiClient.delete(`/sessions/${sessionId}/visitors/${memberId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Xóa khách vãng lai thất bại.');
    }
  };

  const handleToggleLocalAttendance = (sessionId: string, memberId: string) => {
    setDraftAttendance((prev) => {
      const sessionDraft = { ...(prev[sessionId] || {}) };
      const current = sessionDraft[memberId] || 'ABSENT';
      sessionDraft[memberId] = current === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      return { ...prev, [sessionId]: sessionDraft };
    });
  };

  const handleSaveSessionAttendance = async (sessionId: string) => {
    const sessionDraft = draftAttendance[sessionId] || {};
    const attendancePayload = Object.entries(sessionDraft).map(([member_id, attendance_status]) => ({
      member_id,
      attendance_status
    }));

    setSavingSessionId(sessionId);
    try {
      await apiClient.post(`/sessions/${sessionId}/bulk-edit`, {
        attendance: attendancePayload
      });
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Lưu thay đổi thất bại.');
    } finally {
      setSavingSessionId(null);
    }
  };

  const handleResetSessionDraft = (sessionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;
    const resetDraft: Record<string, 'PRESENT' | 'ABSENT'> = {};
    targetSession.attendance.forEach((a) => {
      resetDraft[a.member_id] = a.attendance_status;
    });
    setDraftAttendance((prev) => ({
      ...prev,
      [sessionId]: resetDraft
    }));
  };

  const handleSaveShuttleUsage = async (sessionId: string) => {
    try {
      await apiClient.put(`/sessions/${sessionId}/shuttle-usage`, {
        shuttle_used: shuttleInputValue
      });
      setEditingShuttleSessionId(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Cập nhật số cầu sử dụng thất bại.');
    }
  };

  const handleCancelSession = async (sessionId: string, sessionDate: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn HỦY buổi chơi ngày ${sessionDate}? Số cầu sử dụng sẽ được hoàn kho.`)) {
      return;
    }

    try {
      await apiClient.post(`/sessions/${sessionId}/cancel`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Hủy buổi chơi thất bại.');
    }
  };

  const filteredMembersForModal = members.filter(
    (m) => m.member_type === 'FIXED' && m.full_name.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  const visitorMembers = members.filter((m) => m.member_type === 'VISITOR');

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-400" />
            <span>LỊCH CHƠI & ĐIỂM DANH BUỔI CHƠI</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tạo buổi chơi, chọn nhanh thành viên tham gia, ghi nhận phí vãng lai theo từng buổi và điểm danh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Filter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Tháng:</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-white font-mono focus:outline-none"
            />
          </div>

          {/* Current Stock Banner */}
          {stockSummary && (
            <div className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Tồn kho hiện tại:</span>
              <span className="font-bold text-emerald-400 font-mono">{stockSummary.tubes_formatted}</span>
            </div>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Buổi Chơi Mới</span>
          </button>
        </div>
      </div>

      {/* Main Sessions List */}
      <div>
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Đang tải danh sách buổi chơi...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
            Chưa có buổi chơi nào được tạo trong tháng {month}.
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => {
              const fixedAttendance = session.attendance.filter((a) => a.member_type === 'FIXED');
              const visitorAttendance = session.attendance.filter((a) => a.member_type === 'VISITOR');
              const isLocked = isSessionLocked(session.session_date);

              const sessionDraft = draftAttendance[session.id] || {};
              const fixedMembersList = members.filter((m) => m.member_type === 'FIXED');
              const hasAttendanceChanges = fixedMembersList.some((member) => {
                const origStatus = fixedAttendance.find((a) => a.member_id === member.id)?.attendance_status || 'ABSENT';
                const draftStatus = sessionDraft[member.id] !== undefined ? sessionDraft[member.id] : origStatus;
                return origStatus !== draftStatus;
              });

              return (
                <div
                  key={session.id}
                  className={`bg-slate-900 border rounded-2xl p-6 transition ${
                    session.status === 'CANCELLED'
                      ? 'border-rose-900/40 opacity-75'
                      : isLocked
                      ? 'border-amber-900/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Session Lock Banner */}
                  {isLocked && (
                    <div className="mb-4 px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>🔒 Buổi chơi đã khóa, không thể chỉnh sửa.</span>
                    </div>
                  )}

                  {/* Session Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-3 py-1 rounded-xl text-xs font-bold font-mono ${
                          session.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {session.session_date}
                      </div>

                      <div className="text-sm font-semibold text-white">
                        {session.notes || `Buổi chơi ngày ${session.session_date}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      {/* Add Visitor Button */}
                      {session.status !== 'CANCELLED' && (
                        <button
                          disabled={isLocked}
                          onClick={() => {
                            setAddingVisitorSessionId(session.id);
                            setSelectedVisitorMemberId('');
                            setVisitorNameInput('');
                            setVisitorAmountInput(50000);
                            setVisitorPaidInput(false);
                          }}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Thêm vãng lai</span>
                        </button>
                      )}

                      {/* Players Count */}
                      <div className="flex items-center gap-1.5 text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Có mặt:</span>
                        <span className="font-bold text-emerald-400 font-mono">{session.total_players}</span>
                      </div>

                      {/* Shuttle Used */}
                      <div className="flex items-center gap-1.5 text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cầu dùng:</span>
                        {editingShuttleSessionId === session.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={shuttleInputValue}
                              onChange={(e) => setShuttleInputValue(parseInt(e.target.value, 10) || 0)}
                              className="w-14 bg-slate-800 text-amber-300 text-xs px-1.5 py-0.5 rounded font-mono border border-amber-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveShuttleUsage(session.id)}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[11px]"
                            >
                              Lưu
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={session.status === 'CANCELLED' || isLocked}
                            onClick={() => {
                              setEditingShuttleSessionId(session.id);
                              setShuttleInputValue(session.shuttle_used);
                            }}
                            className="font-mono text-base font-bold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-0.5 rounded-lg hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {session.shuttle_used} trái
                          </button>
                        )}
                      </div>

                      {/* Cancel Session Button */}
                      {session.status !== 'CANCELLED' && (
                        <button
                          disabled={isLocked}
                          onClick={() => handleCancelSession(session.id, session.session_date)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Hủy Buổi</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Section 1: Visitors Participated in Session */}
                  {visitorAttendance.length > 0 && (
                    <div className="mt-4 pb-4 border-b border-slate-800/60">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4" />
                        <span>Khách vãng lai tham gia buổi này ({visitorAttendance.length})</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {visitorAttendance.map((vis) => {
                          const isPaid = vis.visitor_fee_status === 'PAID';
                          const feeId = vis.visitor_fee_id;

                          return (
                            <div
                              key={vis.member_id}
                              className={`p-3.5 rounded-xl border space-y-2 relative transition ${
                                isPaid
                                  ? 'bg-emerald-950/30 border-emerald-500/40'
                                  : 'bg-amber-950/20 border-amber-500/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-sm text-white truncate">{vis.full_name}</div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    isPaid
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  }`}
                                >
                                  {isPaid ? '🟢 Đã đóng' : '🔴 Chưa đóng'}
                                </span>
                              </div>

                              {/* Editable Fee Amount */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Phí buổi này:</span>
                                {isPaid ? (
                                  <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
                                    <span>{(vis.visitor_fee_amount || 50000).toLocaleString()} ₫</span>
                                    <span title="Khoản đã thanh toán - Không thể chỉnh sửa">
                                      <Lock className="w-3 h-3 text-slate-500" />
                                    </span>
                                  </div>
                                ) : editingFeeId === feeId ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="1000"
                                      value={editingFeeValue}
                                      onChange={(e) => setEditingFeeValue(parseInt(e.target.value, 10) || 0)}
                                      className="w-20 bg-slate-800 text-white font-mono text-xs px-1.5 py-0.5 rounded border border-amber-500"
                                    />
                                    <button
                                      onClick={() => feeId && handleUpdateVisitorFeeAmount(feeId)}
                                      className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded"
                                    >
                                      Lưu
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    disabled={isLocked}
                                    onClick={() => {
                                      if (feeId) {
                                        setEditingFeeId(feeId);
                                        setEditingFeeValue(vis.visitor_fee_amount || 50000);
                                      }
                                    }}
                                    className="font-mono font-bold text-amber-300 hover:text-white underline decoration-dashed disabled:no-underline disabled:opacity-60 disabled:cursor-not-allowed"
                                    title={isLocked ? 'Buổi đã khóa - Không thể sửa' : 'Click để sửa phí buổi này'}
                                  >
                                    {(vis.visitor_fee_amount || 50000).toLocaleString()} ₫
                                  </button>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center justify-between pt-1">
                                {!isPaid && feeId ? (
                                  <button
                                    onClick={() => handleMarkVisitorPaid(feeId)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition shadow-sm"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>Đã đóng</span>
                                  </button>
                                ) : (
                                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Thu chi tiết</span>
                                  </div>
                                )}

                                <button
                                  disabled={isPaid || isLocked}
                                  onClick={() => handleRemoveVisitor(session.id, vis.member_id, isPaid)}
                                  className={`p-1 text-slate-400 hover:text-rose-400 rounded transition ${
                                    isPaid || isLocked ? 'opacity-30 cursor-not-allowed' : ''
                                  }`}
                                  title={isPaid ? 'Khoản đã đóng - Không thể xóa' : isLocked ? 'Buổi đã khóa - Không thể xóa' : 'Xóa vãng lai khỏi buổi'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Fixed Members Attendance Checklist */}
                  <div className="mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Điểm danh thành viên cố định (Click checkbox):
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAttendanceChanges && (
                          <button
                            type="button"
                            disabled={savingSessionId === session.id}
                            onClick={() => handleResetSessionDraft(session.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                          >
                            Hủy thay đổi
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!hasAttendanceChanges || savingSessionId === session.id || isLocked || session.status === 'CANCELLED'}
                          onClick={() => handleSaveSessionAttendance(session.id)}
                          className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5 ${
                            hasAttendanceChanges && !isLocked && session.status !== 'CANCELLED'
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/50'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          }`}
                        >
                          {savingSessionId === session.id ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {fixedMembersList.map((member) => {
                        const origStatus = fixedAttendance.find((a) => a.member_id === member.id)?.attendance_status || 'ABSENT';
                        const draftStatus = sessionDraft[member.id] !== undefined ? sessionDraft[member.id] : origStatus;
                        const isPresent = draftStatus === 'PRESENT';

                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={isLocked || session.status === 'CANCELLED'}
                            onClick={() => handleToggleLocalAttendance(session.id, member.id)}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                              isPresent
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200 shadow-md shadow-emerald-950/30'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <div className="truncate">
                              <div className="font-semibold text-sm truncate">{member.full_name}</div>
                              <div className="text-[10px] text-slate-500 uppercase">Cố định</div>
                            </div>

                            {isPresent ? (
                              <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0 ml-2" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-600 flex-shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Add Visitor to Existing Session Modal */}
      {addingVisitorSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              <span>Thêm Khách Vãng Lai Vào Buổi Chơi</span>
            </h2>

            <form onSubmit={handleAddVisitorToSession} className="space-y-4">
              {/* Option 1: Select existing Master Visitor Member */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chọn Khách Vãng Lai Có Sẵn</label>
                <select
                  value={selectedVisitorMemberId}
                  onChange={(e) => {
                    setSelectedVisitorMemberId(e.target.value);
                    if (e.target.value) setVisitorNameInput('');
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Chọn khách vãng lai đã có trong hệ thống --</option>
                  {visitorMembers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.phone || 'Chưa có SĐT'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Option 2: Or create new visitor name */}
              {!selectedVisitorMemberId && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Hoặc Tên Khách Mới (*)</label>
                  <input
                    type="text"
                    placeholder="VD: Dũng (Vãng lai)"
                    value={visitorNameInput}
                    onChange={(e) => setVisitorNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phí Buổi Này (VNĐ, Không Roundup)</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={visitorAmountInput}
                  onChange={(e) => setVisitorAmountInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                <span>🔴 Trạng thái: Chưa đóng (Tự động ghi nhận công nợ UNPAID)</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddingVisitorSessionId(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition shadow-md"
                >
                  Thêm Khách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Session Modal with Multi-select Members & Visitor option */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white">Tạo Buổi Chơi Mới</h2>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ngày chơi (*)</label>
                <input
                  type="date"
                  required
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ghi chú buổi chơi</label>
                <input
                  type="text"
                  value={newSessionNotes}
                  onChange={(e) => setNewSessionNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="VD: Buổi sáng thứ 7..."
                />
              </div>

              {/* Multi-select Members Section */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Chọn Thành Viên Cố Định Có Mặt
                  </label>
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-bold">
                    Đã chọn: {selectedMemberIds.length} TV
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Tìm tên thành viên..."
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllFixed}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg border border-slate-700"
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg border border-slate-700"
                  >
                    Bỏ chọn
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  {filteredMembersForModal.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-2">Không tìm thấy thành viên cố định.</div>
                  ) : (
                    filteredMembersForModal.map((member) => {
                      const isSelected = selectedMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                            isSelected ? 'bg-emerald-950/60 text-emerald-300' : 'text-slate-400 hover:bg-slate-900'
                          }`}
                        >
                          <span className="font-semibold">{member.full_name}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectMember(member.id)}
                            className="w-4 h-4 accent-emerald-500"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Optional Add Visitor Section */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                  <input
                    type="checkbox"
                    checked={includeVisitor}
                    onChange={(e) => setIncludeVisitor(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Thêm Khách Vãng Lai Cho Buổi Này (Tùy chọn)</span>
                </label>

                {includeVisitor && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    {/* Option A: Select existing Visitor Member */}
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Chọn Khách Vãng Lai Có Sẵn</label>
                      <select
                        value={selectedVisitorMemberId}
                        onChange={(e) => {
                          setSelectedVisitorMemberId(e.target.value);
                          if (e.target.value) setVisitorNameInput('');
                        }}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                      >
                        <option value="">-- Chọn khách vãng lai trong hệ thống --</option>
                        {visitorMembers.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.full_name} ({v.phone || 'Chưa có SĐT'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Option B: Or enter new visitor name */}
                    {!selectedVisitorMemberId && (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Hoặc Tên Khách Vãng Lai Mới (*)</label>
                        <input
                          type="text"
                          placeholder="VD: Anh Nam (Vãng lai)"
                          value={visitorNameInput}
                          onChange={(e) => setVisitorNameInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Phí Buổi Này (VNĐ, Không Roundup)</label>
                      <input
                        type="number"
                        min="0"
                        value={visitorAmountInput}
                        onChange={(e) => setVisitorAmountInput(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                      <span>🔴 Trạng thái: Chưa đóng (Tự động ghi nhận công nợ UNPAID)</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo buổi chơi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
