import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import {
  getMonthlyDashboardReport,
  isValidMonthKey,
  isValidYear,
  getFundPaymentReport,
  getExpenseReport,
  getAttendanceReport,
  getShuttleUsageReport
} from '../services/reportService';
import { getMemberDebts } from '../services/feeEngine';
import { toPublicSaokeDTO } from '../types/publicSaoke';
import { toPublicDebtorDTOList } from '../types/publicSaokeDebtors';

export const getPublicSaokeMonthlyReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    if (!month || !isValidMonthKey(month as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12).'
        }
      });
    }

    try {
      const rawReport = getMonthlyDashboardReport(db, month as string);
      const publicDto = toPublicSaokeDTO(rawReport);

      return res.status(200).json({
        success: true,
        data: publicDto
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REPORT_ERROR',
          message: err.message || 'Lỗi khi tạo báo cáo tài chính công khai.'
        }
      });
    }
  };
};

export const getPublicSaokeDebtorsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    if (!month || !isValidMonthKey(month as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12).'
        }
      });
    }

    try {
      const rawDebts = getMemberDebts(db, month as string);
      const publicDebtors = toPublicDebtorDTOList(rawDebts, month as string);

      return res.status(200).json({
        success: true,
        data: publicDebtors
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DEBTORS_FETCH_ERROR',
          message: err.message || 'Lỗi khi lấy danh sách nợ quỹ công khai.'
        }
      });
    }
  };
};

export const getPublicFundPaymentReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, year } = req.query;

    try {
      const report = getFundPaymentReport(db, {
        month: month as string,
        year: year as string
      });

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'REPORT_ERROR', message: err.message }
      });
    }
  };
};

export const getPublicExpenseReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, year } = req.query;

    try {
      const report = getExpenseReport(db, {
        month: month as string,
        year: year as string
      });

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'REPORT_ERROR', message: err.message }
      });
    }
  };
};

export const getPublicAttendanceReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, year } = req.query;

    try {
      const report = getAttendanceReport(db, {
        month: month as string,
        year: year as string
      });

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'REPORT_ERROR', message: err.message }
      });
    }
  };
};

export const getPublicShuttleUsageReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { period_type, month, year } = req.query;

    try {
      const report = getShuttleUsageReport(db, {
        periodType: (period_type as any) || 'DAILY',
        month: month as string,
        year: year as string
      });

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'REPORT_ERROR', message: err.message }
      });
    }
  };
};
