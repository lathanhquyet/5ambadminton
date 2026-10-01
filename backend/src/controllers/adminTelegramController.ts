import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import {
  getAdminTelegramSettingsDTO,
  updateTelegramSettings,
  sendTelegramNotification
} from '../services/telegramSettingsService';

export const getAdminTelegramSettingsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const dto = getAdminTelegramSettingsDTO(db);
      return res.status(200).json({
        success: true,
        data: dto
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Lỗi khi tải cấu hình Telegram.'
        }
      });
    }
  };
};

export const updateAdminTelegramSettingsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const { enabled, botToken, chatId } = req.body;
      const dto = updateTelegramSettings(db, { enabled, botToken, chatId });
      return res.status(200).json({
        success: true,
        data: dto
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'Lỗi khi cập nhật cấu hình Telegram.'
        }
      });
    }
  };
};

export const testAdminTelegramHandler = (dbInstance?: DatabaseType) => {
  return async (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const result = await sendTelegramNotification(
        db,
        ' Quỹ Cầu Lông 5AM: Kiểm tra kết nối Telegram Bot thành công!'
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TELEGRAM_SEND_FAILED',
            message: result.error || 'Gửi tin nhắn thử nghiệm thất bại.'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          message: 'Đã gửi tin nhắn kiểm tra tới Telegram thành công.'
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Lỗi khi gửi tin nhắn kiểm tra Telegram.'
        }
      });
    }
  };
};
