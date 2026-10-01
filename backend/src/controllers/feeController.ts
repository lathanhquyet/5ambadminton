import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  calculateMonthlyFixedFees,
  calculateVisitorFees,
  getMemberDebts,
  recordMemberPayment,
  generateVietQRData
} from '../services/feeEngine';

export const calculateMonthlyFeesHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month_key, calculation_method, total_cost, visitor_price, manual_amounts } = req.body;

    if (!month_key) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'month_key (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const fixedResult = calculateMonthlyFixedFees(db, {
        monthKey: month_key,
        calculationMethod: calculation_method || 'EQUAL_SPLIT',
        totalCostToAllocate: total_cost || 0,
        manualMemberAmounts: manual_amounts || {},
        userId: req.user?.id
      });

      const visitorResult = calculateVisitorFees(db, month_key, visitor_price || 70000);

      return res.status(200).json({
        success: true,
        data: {
          month_key,
          fixed_fees: fixedResult,
          visitor_fees: visitorResult
        },
        message: 'Tính phí tháng thành công.'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'FEE_CALCULATION_ERROR', message: err.message || 'Lỗi khi tính phí tháng.' }
      });
    }
  };
};

export const getDebtsHandler = (dbInstance?: DatabaseType) => {
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
      const debts = getMemberDebts(db, month as string);
      return res.status(200).json({
        success: true,
        data: debts
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'DEBT_FETCH_ERROR', message: err.message }
      });
    }
  };
};

export const recordPaymentHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { member_id, month_key, payment_date, amount, payment_method, bank_tx_code, notes } = req.body;

    if (!member_id || !month_key || !payment_date || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Các tham số member_id, month_key, payment_date, amount là bắt buộc.'
        }
      });
    }

    try {
      const result = recordMemberPayment(db, {
        memberId: member_id,
        monthKey: month_key,
        paymentDate: payment_date,
        amount: parseInt(amount, 10),
        paymentMethod: payment_method || 'BANK_TRANSFER',
        bankTxCode: bank_tx_code,
        notes,
        userId: req.user?.id
      });

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Ghi nhận đóng tiền thành công.'
      });
    } catch (err: any) {
      const statusCode = err.code === 'PAYMENT_EXCEEDS_DEBT' ? 400 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || 'PAYMENT_ERROR',
          message: err.message || 'Ghi nhận đóng tiền thất bại.'
        }
      });
    }
  };
};

export const generateVietQRHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { member_id } = req.params;
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tham số month (YYYY-MM) là bắt buộc.' }
      });
    }

    try {
      const qrData = generateVietQRData(db, member_id, month as string);
      return res.status(200).json({
        success: true,
        data: qrData
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'VIETQR_ERROR', message: err.message }
      });
    }
  };
};
