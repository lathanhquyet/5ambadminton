import { Request, Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  getStockSummary,
  manualStockReceipt,
  manualStockIssue,
  manualStockAdjustment,
  getInventoryTransactionsList
} from '../services/inventoryService';

export const getInventorySummaryHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    try {
      const summary = getStockSummary(db);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};

export const getInventoryTransactionsHandler = (dbInstance?: DatabaseType) => {
  return (req: Request, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month, product_id, type } = req.query;

    try {
      const list = getInventoryTransactionsList(db, {
        monthKey: month as string,
        productId: product_id as string,
        transactionType: type as string
      });

      return res.status(200).json({
        success: true,
        data: list
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};

export const manualReceiptHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { product_id, tubes_qty, pieces_qty, date, supplier, notes } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'date (YYYY-MM-DD) là bắt buộc.' }
      });
    }

    try {
      const result = manualStockReceipt(db, {
        productId: product_id || 'prod_tc77',
        tubesQty: tubes_qty ? parseInt(tubes_qty, 10) : 0,
        piecesQty: pieces_qty ? parseInt(pieces_qty, 10) : 0,
        date,
        supplier,
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Nhập kho thủ công thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};

export const manualIssueHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { product_id, tubes_qty, pieces_qty, date, reason, notes } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'date (YYYY-MM-DD) là bắt buộc.' }
      });
    }

    try {
      const result = manualStockIssue(db, {
        productId: product_id || 'prod_tc77',
        tubesQty: tubes_qty ? parseInt(tubes_qty, 10) : 0,
        piecesQty: pieces_qty ? parseInt(pieces_qty, 10) : 0,
        date,
        reason,
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Xuất kho thủ công thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};

export const manualAdjustmentHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { product_id, adjustment_type, quantity_in_pieces, date, reason, notes } = req.body;

    if (!date || !adjustment_type || quantity_in_pieces === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'date, adjustment_type (INCREASE/DECREASE), quantity_in_pieces và reason là bắt buộc.'
        }
      });
    }

    if (!['INCREASE', 'DECREASE'].includes(adjustment_type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'adjustment_type phải là INCREASE hoặc DECREASE.' }
      });
    }

    try {
      const result = manualStockAdjustment(db, {
        productId: product_id || 'prod_tc77',
        adjustmentType: adjustment_type,
        quantityInPieces: parseInt(quantity_in_pieces, 10),
        date,
        reason,
        notes,
        userId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Điều chỉnh tồn kho thành công.'
      });
    } catch (err: any) {
      const isClosed = err.message && err.message.includes('CLOSED');
      return res.status(isClosed ? 403 : 400).json({
        success: false,
        error: { code: isClosed ? 'MONTH_CLOSED' : 'INVENTORY_ERROR', message: err.message }
      });
    }
  };
};
