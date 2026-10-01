import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { getPaymentSettings, updatePaymentSettings } from '../services/paymentSettingsService';

export const getAdminPaymentSettingsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const settings = getPaymentSettings(db);
      return res.status(200).json({
        success: true,
        data: settings
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Lỗi khi tải cấu hình thanh toán.'
        }
      });
    }
  };
};

export const updateAdminPaymentSettingsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const { enabled, bankName, bankBin, accountNumber, accountName } = req.body;
      const updated = updatePaymentSettings(db, {
        enabled,
        bankName,
        bankBin,
        accountNumber,
        accountName
      });

      return res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'Lỗi khi cập nhật cấu hình thanh toán.'
        }
      });
    }
  };
};
