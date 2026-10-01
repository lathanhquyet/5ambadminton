import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  recordCourtFeeConfig,
  recordCourtFeeManualExpense,
  recordShuttlePurchase,
  recordMidMonthJoinerIncome,
  recordOtherExpense,
  recordVisitorFeeManualIncome,
  recordOtherIncome,
  getTransactionHistory,
  voidTransaction,
  getCashLedgerSummary,
  getInventoryCarryForward
} from '../services/cashLedgerService';

export const getLedgerSummaryHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tham số month (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const summary = getCashLedgerSummary(db, month as string);
      const inventoryCarry = getInventoryCarryForward(db, month as string);

      return res.status(200).json({
        success: true,
        data: {
          cash_ledger: summary,
          inventory_carry: inventoryCarry
        }
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'LEDGER_SUMMARY_ERROR', message: err.message }
      });
    }
  };
};

export const recordCourtFeeHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month_key, price_per_day, total_days, total_courts, amount, transaction_date, description, recipient, payment_method, notes } = req.body;

    const parsedAmount = amount !== undefined && amount !== null ? (typeof amount === 'number' ? amount : parseFloat(amount)) : undefined;

    // Check if direct manual court fee voucher (from Phiếu Chi -> Phí sân)
    if (parsedAmount !== undefined && !isNaN(parsedAmount) && parsedAmount > 0 && (price_per_day === undefined || total_days === undefined)) {
      if (!month_key) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'month_key là bắt buộc.' }
        });
      }

      try {
        const result = recordCourtFeeManualExpense(db, {
          transactionDate: transaction_date || `${month_key}-01`,
          monthKey: month_key,
          description,
          recipient,
          amount: parsedAmount,
          paymentMethod: payment_method || 'BANK_TRANSFER',
          notes,
          userId: req.user?.id
        });

        return res.status(201).json({
          success: true,
          data: result,
          message: 'Đã tạo phiếu chi phí sân thành công.'
        });
      } catch (err: any) {
        const isClosed = err.message && err.message.includes('CLOSED');
        return res.status(isClosed ? 403 : 400).json({
          success: false,
          error: { code: isClosed ? 'MONTH_CLOSED' : 'COURT_FEE_ERROR', message: err.message }
        });
      }
    }

    if (!month_key || price_per_day === undefined || total_days === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'month_key, price_per_day, total_days (hoặc amount) là bắt buộc.' }
      });
    }

    try {
      const result = recordCourtFeeConfig(db, {
        monthKey: month_key,
        pricePerDay: parseInt(price_per_day, 10),
        totalDays: parseInt(total_days, 10),
        totalCourts: total_courts ? parseInt(total_courts, 10) : 1,
        notes,
        userId: req.user?.id
      });

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Ghi nhận chi phí sân thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'COURT_FEE_ERROR', message: err.message }
      });
    }
  };
};

export const recordShuttlePurchaseHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { purchase_date, month_key, product_id, supplier, tubes_qty, price_per_tube, notes } = req.body;

    if (!purchase_date || !month_key || !supplier || tubes_qty === undefined || price_per_tube === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'purchase_date, month_key, supplier, tubes_qty, price_per_tube là bắt buộc.'
        }
      });
    }

    try {
      const result = recordShuttlePurchase(db, {
        purchaseDate: purchase_date,
        monthKey: month_key,
        productId: product_id || 'prod_tc77',
        supplier,
        tubesQty: parseInt(tubes_qty, 10),
        pricePerTube: parseInt(price_per_tube, 10),
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Ghi nhận mua cầu (Chi tiền + Nhập kho) thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'SHUTTLE_PURCHASE_ERROR', message: err.message }
      });
    }
  };
};

export const recordMidMonthJoinerHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { member_id, month_key, transaction_date, amount, payment_method, notes } = req.body;

    if (!member_id || !month_key || !transaction_date || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'member_id, month_key, transaction_date, amount là bắt buộc.'
        }
      });
    }

    try {
      const result = recordMidMonthJoinerIncome(db, {
        memberId: member_id,
        monthKey: month_key,
        transactionDate: transaction_date,
        amount: parseInt(amount, 10),
        paymentMethod: payment_method || 'BANK_TRANSFER',
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Ghi nhận thu phí thành viên gia nhập giữa tháng thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'MID_MONTH_JOINER_ERROR', message: err.message }
      });
    }
  };
};

export const recordVisitorFeeManualHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { transaction_date, month_key, payer_name, amount, payment_method, notes } = req.body;

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!transaction_date || !month_key || parsedAmount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Số tiền nộp phải là số dương lớn hơn 0 và thông tin ngày, tháng là bắt buộc.'
        }
      });
    }

    try {
      const result = recordVisitorFeeManualIncome(db, {
        transactionDate: transaction_date,
        monthKey: month_key,
        payerName: payer_name,
        amount: parsedAmount,
        paymentMethod: payment_method || 'CASH',
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Đã tạo phiếu thu phí vãng lai thành công.'
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

export const recordOtherIncomeHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { transaction_date, month_key, description, source, amount, payment_method, notes } = req.body;

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!transaction_date || !month_key || !description || parsedAmount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Số tiền thu phải là số dương lớn hơn 0 và thông tin ngày, tháng, nội dung là bắt buộc.'
        }
      });
    }

    try {
      const result = recordOtherIncome(db, {
        transactionDate: transaction_date,
        monthKey: month_key,
        description,
        source,
        amount: parsedAmount,
        paymentMethod: payment_method || 'BANK_TRANSFER',
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Đã tạo phiếu thu khác thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'OTHER_INCOME_ERROR', message: err.message }
      });
    }
  };
};

export const recordOtherExpenseHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { transaction_date, month_key, description, recipient, amount, payment_method, notes } = req.body;

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!transaction_date || !month_key || !description || parsedAmount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Số tiền chi phải là số dương lớn hơn 0 và thông tin ngày, tháng, nội dung là bắt buộc.'
        }
      });
    }

    try {
      const result = recordOtherExpense(db, {
        transactionDate: transaction_date,
        monthKey: month_key,
        description,
        recipient,
        amount: parsedAmount,
        paymentMethod: payment_method || 'BANK_TRANSFER',
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Đã tạo phiếu chi khác thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'OTHER_EXPENSE_ERROR', message: err.message }
      });
    }
  };
};

export const voidTransactionHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { type, transaction_id } = req.body;

    if (!type || !transaction_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'type (INCOME/EXPENSE) và transaction_id là bắt buộc.' }
      });
    }

    try {
      voidTransaction(db, type as 'INCOME' | 'EXPENSE', transaction_id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: `Đã VOID giao dịch ${type} thành công (loại khỏi Sổ quỹ).`
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'VOID_ERROR', message: err.message }
      });
    }
  };
};

export const getTransactionHistoryHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, type, category, search, page, limit } = req.query;

    try {
      const result = getTransactionHistory(db, {
        monthKey: typeof month === 'string' ? month : undefined,
        type: typeof type === 'string' ? (type as any) : 'ALL',
        category: typeof category === 'string' ? category : 'ALL',
        search: typeof search === 'string' ? search : '',
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'HISTORY_ERROR', message: err.message || 'Lỗi khi tải lịch sử giao dịch.' }
      });
    }
  };
};
