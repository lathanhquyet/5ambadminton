import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  recordSessionShuttleUsage,
  cancelPlayingSession,
  getStockSummary
} from '../services/inventoryService';
import {
  addVisitorToSession,
  markVisitorFeePaid,
  updateVisitorFeeAmount,
  removeVisitorFromSession,
  getVisitorFeeSummary,
  confirmVisitorPaymentByAdmin
} from '../services/visitorFeeService';
import { assertMonthNotClosed } from '../services/feeEngine';

export const getSessionsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, date } = req.query;

    let query = 'SELECT * FROM playing_sessions WHERE 1=1';
    const params: any[] = [];

    if (month) {
      query += ' AND month_key = ?';
      params.push(month);
    }
    if (date) {
      query += ' AND session_date = ?';
      params.push(date);
    }

    query += ' ORDER BY session_date ASC';

    const sessions = db.prepare(query).all(...params) as any[];

    // Include member attendance list for each session with visitor fee details
    const sessionsWithMembers = sessions.map((session) => {
      const attendance = db
        .prepare(`
          SELECT psm.*, m.full_name, m.phone, m.member_type,
                 svf.id AS visitor_fee_id,
                 svf.amount AS visitor_fee_amount,
                 svf.status AS visitor_fee_status,
                 svf.income_transaction_id AS visitor_income_tx_id
          FROM playing_session_members psm
          JOIN members m ON psm.member_id = m.id
          LEFT JOIN session_visitor_fees svf ON svf.session_id = psm.session_id AND svf.member_id = psm.member_id
          WHERE psm.session_id = ?
        `)
        .all(session.id);
      return {
        ...session,
        attendance
      };
    });

    return res.status(200).json({
      success: true,
      data: sessionsWithMembers
    });
  };
};

export const getSessionByIdHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id } = req.params;

    const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(id) as any;
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Không tìm thấy thông tin buổi chơi.'
        }
      });
    }

    const attendance = db
      .prepare(`
        SELECT psm.*, m.full_name, m.phone, m.member_type,
               svf.id AS visitor_fee_id,
               svf.amount AS visitor_fee_amount,
               svf.status AS visitor_fee_status,
               svf.income_transaction_id AS visitor_income_tx_id
        FROM playing_session_members psm
        JOIN members m ON psm.member_id = m.id
        LEFT JOIN session_visitor_fees svf ON svf.session_id = psm.session_id AND svf.member_id = psm.member_id
        WHERE psm.session_id = ?
      `)
      .all(session.id);

    return res.status(200).json({
      success: true,
      data: {
        ...session,
        attendance
      }
    });
  };
};

const parseBoolean = (val: any): boolean => {
  if (val === true || val === false) return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1';
  }
  return Boolean(val);
};

export const createSessionHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { session_date, status, notes, member_ids, visitor, visitors } = req.body;

    if (!session_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'session_date là bắt buộc (định dạng YYYY-MM-DD).'
        }
      });
    }

    const monthKey = session_date.substring(0, 7); // 'YYYY-MM'

    try {
      assertMonthNotClosed(db, monthKey);
    } catch (err: any) {
      return res.status(403).json({
        success: false,
        error: { code: 'MONTH_CLOSED', message: err.message }
      });
    }

    // Check duplicate session_date
    const existingSession = db.prepare('SELECT * FROM playing_sessions WHERE session_date = ?').get(session_date);
    if (existingSession) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_SESSION_DATE',
          message: `Buổi chơi cho ngày ${session_date} đã tồn tại.`
        }
      });
    }

    const sessionId = 'sess_' + session_date.replace(/-/g, '');
    const sessionStatus = status || 'OPEN';

    try {
      const runAtomic = db.transaction(() => {
        // 1. Create playing_session
        db.prepare(`
          INSERT INTO playing_sessions (id, session_date, month_key, status, total_players, shuttle_used, notes, created_by, updated_by)
          VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)
        `).run(
          sessionId,
          session_date,
          monthKey,
          sessionStatus,
          notes || null,
          req.user?.id || null,
          req.user?.id || null
        );

        // 2. Add member attendance if member_ids provided
        if (Array.isArray(member_ids) && member_ids.length > 0) {
          const uniqueMemberIds = Array.from(new Set(member_ids));
          const psmStmt = db.prepare(`
            INSERT OR IGNORE INTO playing_session_members (id, session_id, member_id, attendance_status, checked_by)
            VALUES (?, ?, ?, 'PRESENT', ?)
          `);

          uniqueMemberIds.forEach((mId) => {
            const psmId = 'psm_' + Math.random().toString(36).substring(2, 10);
            psmStmt.run(psmId, sessionId, mId, req.user?.id || null);
          });
        }

        // 3. Add visitors if provided
        const visitorList = visitors || (visitor ? [visitor] : []);
        if (Array.isArray(visitorList) && visitorList.length > 0) {
          visitorList.forEach((vis: any) => {
            if (vis && (vis.full_name || vis.member_id)) {
              addVisitorToSession(db, {
                sessionId,
                memberId: vis.member_id,
                fullName: vis.full_name,
                phone: vis.phone,
                amount: vis.amount !== undefined ? (typeof vis.amount === 'number' ? vis.amount : parseFloat(vis.amount)) : 50000,
                isPaid: parseBoolean(vis.is_paid),
                paymentMethod: vis.payment_method || 'CASH',
                notes: vis.notes,
                userId: req.user?.id
              });
            }
          });
        }

        // 4. Update total_players
        const presentCount = (
          db
            .prepare("SELECT COUNT(*) AS cnt FROM playing_session_members WHERE session_id = ? AND attendance_status = 'PRESENT'")
            .get(sessionId) as any
        ).cnt;

        db.prepare('UPDATE playing_sessions SET total_players = ? WHERE id = ?').run(presentCount, sessionId);

        return db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId);
      });

      const createdSession = runAtomic() as any;

      const attendance = db
        .prepare(`
          SELECT psm.*, m.full_name, m.phone, m.member_type
          FROM playing_session_members psm
          JOIN members m ON psm.member_id = m.id
          WHERE psm.session_id = ?
        `)
        .all(sessionId);

      return res.status(201).json({
        success: true,
        data: {
          ...createdSession,
          attendance
        },
        message: 'Tạo buổi chơi thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'CREATE_SESSION_ERROR', message: err.message }
      });
    }
  };
};

export function isSessionLocked(sessionDateStr: string, currentDateStr?: string): boolean {
  const today = currentDateStr || new Date().toISOString().split('T')[0];
  const sDate = new Date(sessionDateStr + 'T00:00:00Z');
  const lockDate = new Date(sDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const lockDateStr = lockDate.toISOString().split('T')[0];
  return today >= lockDateStr;
}

export const bulkEditSessionHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId } = req.params;
    const { attendance, shuttle_used, notes, current_date } = req.body;

    const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Buổi chơi không tồn tại.' }
      });
    }

    if (session.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_CANCELLED', message: 'Không thể chỉnh sửa buổi chơi đã HỦY.' }
      });
    }

    if (isSessionLocked(session.session_date, current_date)) {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_LOCKED', message: 'Buổi chơi đã khóa (quá 2 ngày từ ngày chơi), không thể chỉnh sửa.' }
      });
    }

    try {
      const runAtomic = db.transaction(() => {
        if (shuttle_used !== undefined || notes !== undefined) {
          db.prepare(`
            UPDATE playing_sessions
            SET shuttle_used = COALESCE(?, shuttle_used),
                notes = COALESCE(?, notes),
                updated_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(shuttle_used !== undefined ? shuttle_used : null, notes !== undefined ? notes : null, req.user?.id || null, sessionId);
        }

        if (Array.isArray(attendance)) {
          const psmUpsert = db.prepare(`
            INSERT INTO playing_session_members (id, session_id, member_id, attendance_status, checked_by)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id, member_id) DO UPDATE SET
              attendance_status = excluded.attendance_status,
              checked_at = CURRENT_TIMESTAMP,
              checked_by = excluded.checked_by
          `);

          attendance.forEach((item: any) => {
            if (item.member_id && item.attendance_status) {
              const psmId = 'psm_' + Math.random().toString(36).substring(2, 10);
              psmUpsert.run(psmId, sessionId, item.member_id, item.attendance_status, req.user?.id || null);
            }
          });

          const totalPlayersResult = db
            .prepare("SELECT COUNT(*) AS cnt FROM playing_session_members WHERE session_id = ? AND attendance_status = 'PRESENT'")
            .get(sessionId) as { cnt: number };

          const totalPlayers = totalPlayersResult ? totalPlayersResult.cnt : 0;
          db.prepare('UPDATE playing_sessions SET total_players = ? WHERE id = ?').run(totalPlayers, sessionId);
        }
      });

      runAtomic();

      const updatedSession = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId);
      return res.status(200).json({
        success: true,
        data: updatedSession,
        message: 'Lưu thay đổi buổi chơi thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'BULK_EDIT_ERROR', message: err.message }
      });
    }
  };
};

export const updateSessionHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id } = req.params;
    const { status, notes, current_date } = req.body;

    const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(id) as any;
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy buổi chơi để cập nhật.' }
      });
    }

    if (isSessionLocked(session.session_date, current_date)) {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_LOCKED', message: 'Buổi chơi đã khóa (quá 2 ngày từ ngày chơi), không thể chỉnh sửa.' }
      });
    }

    // If status is updated to CANCELLED, handle shuttle refund via cancel PlayingSession
    if (status === 'CANCELLED' && session.status !== 'CANCELLED') {
      cancelPlayingSession(db, id, req.user?.id);
    } else {
      const updatedStatus = status || session.status;
      const updatedNotes = notes !== undefined ? notes : session.notes;

      db.prepare(`
        UPDATE playing_sessions
        SET status = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(updatedStatus, updatedNotes, req.user?.id || null, id);
    }

    const updatedSession = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      data: updatedSession,
      message: 'Cập nhật thông tin buổi chơi thành công.'
    });
  };
};

export const updateAttendanceHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId } = req.params;
    const { member_id, attendance_status } = req.body;

    if (!member_id || !attendance_status) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'member_id và attendance_status (PRESENT/ABSENT) là bắt buộc.' }
      });
    }

    if (!['PRESENT', 'ABSENT'].includes(attendance_status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ATTENDANCE_STATUS', message: 'attendance_status phải là PRESENT hoặc ABSENT.' }
      });
    }

    const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Buổi chơi không tồn tại.' }
      });
    }

    if (session.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_CANCELLED', message: 'Không thể điểm danh cho buổi chơi đã HỦY (CANCELLED).' }
      });
    }

    if (isSessionLocked(session.session_date, req.body.current_date)) {
      return res.status(400).json({
        success: false,
        error: { code: 'SESSION_LOCKED', message: 'Buổi chơi đã khóa (quá 2 ngày từ ngày chơi), không thể chỉnh sửa.' }
      });
    }

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Thành viên không tồn tại.' }
      });
    }

    // UPSERT attendance to avoid duplicates for same (session_id, member_id)
    const existingPsm = db
      .prepare('SELECT * FROM playing_session_members WHERE session_id = ? AND member_id = ?')
      .get(sessionId, member_id) as any;

    if (existingPsm) {
      db.prepare(`
        UPDATE playing_session_members
        SET attendance_status = ?, checked_at = CURRENT_TIMESTAMP, checked_by = ?
        WHERE id = ?
      `).run(attendance_status, req.user?.id || null, existingPsm.id);
    } else {
      const psmId = 'psm_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO playing_session_members (id, session_id, member_id, attendance_status, checked_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(psmId, sessionId, member_id, attendance_status, req.user?.id || null);
    }

    // Recount total_players (count PRESENT)
    const totalPlayersResult = db
      .prepare(`
        SELECT COUNT(*) AS cnt
        FROM playing_session_members
        WHERE session_id = ? AND attendance_status = 'PRESENT'
      `)
      .get(sessionId) as { cnt: number };

    const totalPlayers = totalPlayersResult ? totalPlayersResult.cnt : 0;

    db.prepare(`
      UPDATE playing_sessions
      SET total_players = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalPlayers, req.user?.id || null, sessionId);

    return res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        member_id,
        attendance_status,
        total_players: totalPlayers
      },
      message: 'Cập nhật điểm danh thành công.'
    });
  };
};

export const updateShuttleUsageHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId } = req.params;
    const { shuttle_used } = req.body;

    if (shuttle_used === undefined || shuttle_used === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'shuttle_used là bắt buộc.' }
      });
    }

    const parsedShuttleUsed = parseInt(shuttle_used, 10);

    try {
      const result = recordSessionShuttleUsage(db, sessionId, parsedShuttleUsed, req.user?.id);
      const updatedSession = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId);

      return res.status(200).json({
        success: true,
        data: {
          session: updatedSession,
          usage_details: result
        },
        message: 'Cập nhật số cầu sử dụng thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHUTTLE_USAGE_ERROR',
          message: err.message || 'Lỗi khi cập nhật số cầu sử dụng.'
        }
      });
    }
  };
};

export const cancelSessionHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId } = req.params;

    try {
      const result = cancelPlayingSession(db, sessionId, req.user?.id);
      const updatedSession = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId);

      return res.status(200).json({
        success: true,
        data: {
          session: updatedSession,
          refund_details: result
        },
        message: 'Hủy buổi chơi và hoàn kho cầu thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANCEL_SESSION_ERROR',
          message: err.message || 'Lỗi khi hủy buổi chơi.'
        }
      });
    }
  };
};

export const getInventorySummaryHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const summary = getStockSummary(db, 'prod_tc77');
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};

export const addVisitorHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId } = req.params;
    const { member_id, full_name, phone, amount, is_paid, notes } = req.body;

    try {
      const result = addVisitorToSession(db, {
        sessionId,
        memberId: member_id,
        fullName: full_name,
        phone,
        amount: amount !== undefined ? (typeof amount === 'number' ? amount : parseFloat(amount)) : 50000,
        isPaid: parseBoolean(is_paid),
        paymentMethod: req.body.payment_method || 'CASH',
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Thêm khách vãng lai vào buổi chơi thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'ADD_VISITOR_ERROR', message: err.message }
      });
    }
  };
};

export const markVisitorFeePaidHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { feeId } = req.params;
    const { payment_method, notes } = req.body;

    try {
      const result = markVisitorFeePaid(db, feeId, payment_method || 'CASH', notes, req.user?.id);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Ghi nhận đã thu phí vãng lai thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'VISITOR_FEE_ERROR', message: err.message }
      });
    }
  };
};

export const updateVisitorFeeHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { feeId } = req.params;
    const { amount } = req.body;

    if (amount === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'amount là bắt buộc.' }
      });
    }

    try {
      const result = updateVisitorFeeAmount(db, feeId, parseInt(amount, 10), req.user?.id);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Cập nhật phí vãng lai thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'VISITOR_FEE_ERROR', message: err.message }
      });
    }
  };
};

export const removeVisitorHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { id: sessionId, memberId } = req.params;

    try {
      const result = removeVisitorFromSession(db, sessionId, memberId, req.user?.id);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Xóa khách vãng lai khỏi buổi chơi thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'REMOVE_VISITOR_ERROR', message: err.message }
      });
    }
  };
};

export const getVisitorFeeSummaryHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'month (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const summary = getVisitorFeeSummary(db, month as string);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'VISITOR_FEE_ERROR', message: err.message }
      });
    }
  };
};

export const confirmVisitorPaymentByAdminHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { member_id, memberId, month_key, monthKey, payment_method } = req.body;

    const targetMemberId = member_id || memberId;
    const targetMonthKey = month_key || monthKey;

    if (!targetMemberId || !targetMonthKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'member_id và month_key là bắt buộc.' }
      });
    }

    try {
      const result = confirmVisitorPaymentByAdmin(
        db,
        targetMemberId,
        targetMonthKey,
        payment_method || 'BANK_TRANSFER',
        req.body.notes,
        req.user?.id
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Admin xác nhận đã nhận tiền phí vãng lai thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'CONFIRM_PAYMENT_ERROR', message: err.message }
      });
    }
  };
};
