import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { getPaymentSettings } from '../services/paymentSettingsService';
import { isValidMonthKey } from '../services/reportService';
import { sendTelegramNotification } from '../services/telegramSettingsService';
import { requestVisitorPayment } from '../services/visitorFeeService';

/**
 * Remove diacritics and convert to ASCII uppercase code/slug for transfer reference.
 */
function toCleanAsciiCode(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

const notificationCooldownMap = new Map<string, number>();

export function clearNotificationCooldownMap() {
  notificationCooldownMap.clear();
}

export const getPublicPaymentInfoHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const settings = getPaymentSettings(db);
      return res.status(200).json({
        success: true,
        data: {
          enabled: settings.enabled,
          bankName: settings.bankName,
          bankBin: settings.bankBin,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message || 'Lỗi khi lấy thông tin thanh toán công khai.'
        }
      });
    }
  };
};

export const getPublicPaymentQRHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, memberId, paymentReference, memberName } = req.query;

    const monthKey = typeof month === 'string' ? month.trim() : '';
    const memId = typeof memberId === 'string' ? memberId.trim() : '';
    const payRef = typeof paymentReference === 'string' ? paymentReference.trim() : '';
    const memName = typeof memberName === 'string' ? memberName.trim() : '';

    // 1. Validate Month
    if (!monthKey || !isValidMonthKey(monthKey)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MONTH',
          message: 'Tháng không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM.'
        }
      });
    }

    // 2. Validate Member (supports memberId, paymentReference, or memberName)
    if (!memId && !payRef && !memName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MEMBER',
          message: 'Vui lòng cung cấp thông tin thành viên (paymentReference, memberName hoặc memberId).'
        }
      });
    }

    let member: { id: string; full_name: string } | undefined;

    if (memId) {
      member = db.prepare('SELECT id, full_name FROM members WHERE id = ?').get(memId) as any;
    }

    if (!member && payRef) {
      const [yearStr, monthStr] = monthKey.split('-');
      const allMembers = db.prepare('SELECT id, full_name FROM members').all() as any[];
      member = allMembers.find((m) => {
        const cleanName = toCleanAsciiCode(m.full_name);
        const memberCode = cleanName ? cleanName.substring(0, 10) : m.id.substring(0, 8).toUpperCase();
        const expectedRef = `5AM-${memberCode}-T${monthStr}-${yearStr}`;
        return expectedRef === payRef;
      });
    }

    if (!member && memName) {
      member = db.prepare('SELECT id, full_name FROM members WHERE full_name = ?').get(memName) as any;
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Không tìm thấy thành viên.'
        }
      });
    }

    // 3. Validate Bank Configuration
    const settings = getPaymentSettings(db);
    if (!settings.enabled || !settings.accountNumber || !settings.bankName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_CONFIGURED',
          message: 'Chưa cấu hình tài khoản nhận tiền. Vui lòng liên hệ quản trị viên.'
        }
      });
    }

    // 4. Calculate Payable Amount (Remaining Debt: Fixed Fees + Visitor Fees)
    const fixedFees = db
      .prepare('SELECT remaining_amount FROM member_fees WHERE month_key = ? AND member_id = ?')
      .all(monthKey, member.id) as { remaining_amount: number }[];

    const fixedDebt = fixedFees.reduce((sum, f) => sum + (f.remaining_amount || 0), 0);

    const visitorFees = db
      .prepare(`
        SELECT svf.amount, svf.status, svf.income_transaction_id
        FROM session_visitor_fees svf
        JOIN playing_sessions ps ON svf.session_id = ps.id
        WHERE ps.month_key = ? AND svf.member_id = ? AND ps.status != 'CANCELLED'
      `)
      .all(monthKey, member.id) as { amount: number; status: string; income_transaction_id?: string }[];

    const visitorDebt = visitorFees.reduce((sum, vf) => {
      if (vf.status !== 'PAID' && !vf.income_transaction_id) {
        return sum + (vf.amount || 0);
      }
      return sum;
    }, 0);

    const remainingDebt = fixedDebt + visitorDebt;

    if (remainingDebt <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PAYMENT_DUE',
          message: 'Không có khoản cần thanh toán.'
        }
      });
    }

    // 5. Deterministic Transfer Content Construction
    const [yearStr, monthStr] = monthKey.split('-');
    const cleanName = toCleanAsciiCode(member.full_name);
    const memberCode = cleanName ? cleanName.substring(0, 10) : member.id.substring(0, 8).toUpperCase();
    const transferContent = `5AM-${memberCode}-T${monthStr}-${yearStr}`;

    // 6. Generate VietQR URL
    const encodedInfo = encodeURIComponent(transferContent);
    const qrUrl = `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact.png?amount=${remainingDebt}&addInfo=${encodedInfo}`;

    return res.status(200).json({
      success: true,
      data: {
        month: monthKey,
        memberName: member.full_name,
        memberCode,
        amount: remainingDebt,
        currency: 'VND',
        bankName: settings.bankName,
        bankBin: settings.bankBin,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
        transferContent,
        qr: {
          format: 'image',
          url: qrUrl
        }
      }
    });
  };
};

export const notifyPublicPaymentHandler = (dbInstance?: DatabaseType) => {
  return async (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;

    // Strict extraction: ONLY paymentReference from body. Ignore any custom injected name/amount/token/chatId
    const payRef = typeof req.body?.paymentReference === 'string' ? req.body.paymentReference.trim() : '';

    if (!payRef) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_REF',
          message: 'Vui lòng cung cấp mã chuyển khoản (paymentReference).'
        }
      });
    }

    // Cooldown check for duplicate suppression (5 seconds)
    const now = Date.now();
    const lastSent = notificationCooldownMap.get(payRef) || 0;
    if (now - lastSent < 5000) {
      return res.status(200).json({
        success: true,
        data: {
          notified: false,
          message: 'Thông báo chuyển khoản đã được gửi gần đây.'
        }
      });
    }

    // Parse paymentReference format: 5AM-<MEMBER_CODE>-T<MM>-<YYYY>
    const match = payRef.match(/^5AM-(.+)-T(\d{2})-(\d{4})$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_REF_FORMAT',
          message: 'Định dạng mã chuyển khoản không đúng.'
        }
      });
    }

    const [, codePart, monthStr, yearStr] = match;
    const monthKey = `${yearStr}-${monthStr}`;

    // Resolve member & remaining debt from DB
    const allMembers = db.prepare('SELECT id, full_name FROM members').all() as { id: string; full_name: string }[];
    const member = allMembers.find((m) => {
      const cleanName = toCleanAsciiCode(m.full_name);
      const memberCode = cleanName ? cleanName.substring(0, 10) : m.id.substring(0, 8).toUpperCase();
      return memberCode === codePart || m.id.substring(0, 8).toUpperCase() === codePart;
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Không tìm thấy thông tin người nhận tương ứng với mã chuyển khoản.'
        }
      });
    }

    // Calculate remaining debt amount
    const fixedFees = db
      .prepare('SELECT remaining_amount FROM member_fees WHERE month_key = ? AND member_id = ?')
      .all(monthKey, member.id) as { remaining_amount: number }[];
    const fixedDebt = fixedFees.reduce((sum, f) => sum + (f.remaining_amount || 0), 0);

    const visitorFees = db
      .prepare(`
        SELECT svf.amount, svf.status, svf.income_transaction_id
        FROM session_visitor_fees svf
        JOIN playing_sessions ps ON svf.session_id = ps.id
        WHERE ps.month_key = ? AND svf.member_id = ? AND ps.status != 'CANCELLED'
      `)
      .all(monthKey, member.id) as { amount: number; status: string; income_transaction_id?: string }[];

    const visitorDebt = visitorFees.reduce((sum, vf) => {
      if (vf.status !== 'PAID' && !vf.income_transaction_id) {
        return sum + (vf.amount || 0);
      }
      return sum;
    }, 0);

    const remainingDebt = fixedDebt + visitorDebt;
    if (remainingDebt <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PAYMENT_DUE',
          message: 'Khoản nợ này đã được thanh toán xong.'
        }
      });
    }

    // If member has visitor fees, transition them to PAYMENT_REQUESTED state (0 financial mutation)
    requestVisitorPayment(db, member.id, monthKey);

    // Format mandatory Telegram message: "Anh [Tên] đã chuyển khoản [Số tiền ₫]"
    const formattedAmount = `${remainingDebt.toLocaleString('vi-VN')} ₫`;
    const message = `Anh ${member.full_name} đã chuyển khoản ${formattedAmount}`;

    // Set cooldown timestamp
    notificationCooldownMap.set(payRef, now);

    // Send Telegram Notification (ZERO financial mutation)
    const result = await sendTelegramNotification(db, message);

    return res.status(200).json({
      success: true,
      data: {
        notified: result.success,
        message: result.success ? 'Đã gửi thông báo đến Telegram thành công.' : result.error
      }
    });
  };
};
