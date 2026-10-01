import { Response } from 'express';
import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getCashLedgerSummary, getTransactionHistory } from '../services/cashLedgerService';
import { getMemberDebts } from '../services/feeEngine';
import { getAuditLogs } from '../services/closingService';

function convertToCSV(data: Record<string, any>[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export const exportMonthlyReportCSVHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
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
      const csvData = [
        { Metric: 'Tháng', Value: summary.month_key },
        { Metric: 'Số dư đầu kỳ', Value: summary.opening_balance },
        { Metric: 'Tổng Thu', Value: summary.total_income },
        { Metric: '  - Quỹ Cố Định', Value: summary.income_breakdown.fixed_fund },
        { Metric: '  - Phí Vãng Lai', Value: summary.income_breakdown.visitor_fee },
        { Metric: '  - Thu Khác', Value: summary.income_breakdown.other_income },
        { Metric: 'Tổng Chi', Value: summary.total_expense },
        { Metric: '  - Tiền Sân', Value: summary.expense_breakdown.court_fee },
        { Metric: '  - Mua Cầu', Value: summary.expense_breakdown.shuttle_purchase },
        { Metric: '  - Chi Khác', Value: summary.expense_breakdown.other_expense },
        { Metric: 'Thu Chi Ròng trong tháng', Value: summary.net_month_balance },
        { Metric: 'Số dư cuối kỳ', Value: summary.ending_balance }
      ];

      const csv = convertToCSV(csvData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${month}.csv`);
      return res.status(200).send('\uFEFF' + csv);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXPORT_ERROR', message: err.message }
      });
    }
  };
};

export const exportIncomeCSVHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    try {
      const history = getTransactionHistory(db, {
        monthKey: month as string,
        type: 'INCOME',
        limit: 1000
      });

      const exportRows = (history.items || []).map((tx: any) => ({
        ID: tx.id,
        Ngay: tx.transaction_date,
        Thang: tx.month_key,
        DanhMuc: tx.category,
        MoTa: tx.description,
        NguoiNop: tx.member_name || '',
        SoTien: tx.rounded_amount,
        HinhThuc: tx.payment_method,
        NguoiTao: tx.created_by_name || ''
      }));

      const csv = convertToCSV(exportRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Income_${month || 'ALL'}.csv`);
      return res.status(200).send('\uFEFF' + csv);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXPORT_ERROR', message: err.message }
      });
    }
  };
};

export const exportExpenseCSVHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;
    const { month } = req.query;

    try {
      const history = getTransactionHistory(db, {
        monthKey: month as string,
        type: 'EXPENSE',
        limit: 1000
      });

      const exportRows = (history.items || []).map((tx: any) => ({
        ID: tx.id,
        Ngay: tx.transaction_date,
        Thang: tx.month_key,
        DanhMuc: tx.category,
        MoTa: tx.description,
        NguoiNhan: tx.recipient || '',
        SoTien: tx.rounded_amount,
        HinhThuc: tx.payment_method,
        NguoiTao: tx.created_by_name || ''
      }));

      const csv = convertToCSV(exportRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Expense_${month || 'ALL'}.csv`);
      return res.status(200).send('\uFEFF' + csv);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXPORT_ERROR', message: err.message }
      });
    }
  };
};

export const exportVisitorDebtsCSVHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
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
      const visitorDebts = debts.filter((d: any) => d.member_type === 'VISITOR');
      const exportRows = visitorDebts.map((v: any) => ({
        MemberID: v.member_id,
        HoTen: v.full_name,
        LoaiThanhVien: v.member_type,
        TongPhaiNop: v.total_due,
        DaNop: v.paid_amount,
        ConNo: v.remaining_amount,
        TrangThai: v.fee_status
      }));

      const csv = convertToCSV(exportRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Visitor_Debts_${month}.csv`);
      return res.status(200).send('\uFEFF' + csv);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXPORT_ERROR', message: err.message }
      });
    }
  };
};

export const exportAuditLogsCSVHandler = (dbInstance?: DatabaseType) => {
  return (req: AuthRequest, res: Response) => {
    const db = dbInstance || defaultDb;

    try {
      const logs = getAuditLogs(db, { limit: 1000 });
      const exportRows = logs.map((log: any) => ({
        ID: log.id,
        ThoiGian: log.created_at,
        UserID: log.user_id || 'system',
        HanhDong: log.action,
        Module: log.module,
        RecordID: log.record_id,
        OldValue: log.old_value_json || '',
        NewValue: log.new_value_json || ''
      }));

      const csv = convertToCSV(exportRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=Audit_Logs.csv');
      return res.status(200).send('\uFEFF' + csv);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'EXPORT_ERROR', message: err.message }
      });
    }
  };
};
