import { Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { closeMonth, unlockMonth, getMonthlyClosingStatus, getAuditLogs } from '../services/closingService';

export const getClosingStatusHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.params;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tham số month (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const status = getMonthlyClosingStatus(db, month);
      return res.status(200).json({
        success: true,
        data: status || { month_key: month, status: 'OPEN' }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'CLOSING_STATUS_ERROR', message: err.message }
      });
    }
  };
};

export const closeMonthHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.params;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tham số month (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const userId = req.user?.id || 'system';
      const result = closeMonth(db, month, userId);

      return res.status(200).json({
        success: true,
        data: result,
        message: `Chốt sổ sách tháng ${month} thành công.`
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'CLOSE_MONTH_ERROR', message: err.message }
      });
    }
  };
};

export const unlockMonthHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.params;
    const { reason } = req.body;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tham số month (YYYY-MM) là bắt buộc.' }
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Bắt buộc nhập lý do mở khóa sổ sách.' }
      });
    }

    // Role check: Only ADMIN can unlock
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Chỉ Admin mới có quyền mở khóa sổ sách đã đóng.' }
      });
    }

    try {
      const userId = req.user?.id || 'admin';
      const result = unlockMonth(db, month, userId, reason.trim());

      return res.status(200).json({
        success: true,
        data: result,
        message: `Mở khóa sổ sách tháng ${month} thành công.`
      });
    } catch (err: any) {
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        error: { code: err.code || 'UNLOCK_MONTH_ERROR', message: err.message }
      });
    }
  };
};

export const getAuditLogsHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { module, record_id, limit } = req.query;

    try {
      const logs = getAuditLogs(db, {
        module: module as string,
        recordId: record_id as string,
        limit: limit ? parseInt(limit as string, 10) : 100
      });

      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'AUDIT_LOG_ERROR', message: err.message }
      });
    }
  };
};
