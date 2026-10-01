import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { getMonthlyDashboardReport, isValidMonthKey } from '../services/reportService';

export const getMonthlyReportHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    if (!month || !isValidMonthKey(month)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12).'
        }
      });
    }

    try {
      const report = getMonthlyDashboardReport(db, month as string);
      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REPORT_ERROR',
          message: err.message || 'Lỗi khi tạo báo cáo tài chính tháng.'
        }
      });
    }
  };
};
