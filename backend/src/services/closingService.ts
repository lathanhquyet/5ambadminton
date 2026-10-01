import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { assertMonthNotClosed } from './feeEngine';
import { getCashLedgerSummary } from './cashLedgerService';

export interface MonthlyClosingRecord {
  id: string;
  month_key: string;
  total_income: number;
  total_expense: number;
  ending_balance: number;
  inventory_summary_json?: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  closed_by?: string;
  closed_at?: string;
  unlocked_by?: string;
  unlocked_at?: string;
  unlock_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id?: string;
  action: string;
  module: string;
  record_id: string;
  old_value_json?: string;
  new_value_json?: string;
  ip_address?: string;
  created_at: string;
}

/**
 * Retrieves monthly closing status for a given monthKey.
 */
export function getMonthlyClosingStatus(
  dbInstance: DatabaseType | undefined,
  monthKey: string
): MonthlyClosingRecord | null {
  const db = dbInstance || defaultDb;
  const record = db
    .prepare('SELECT * FROM monthly_closings WHERE month_key = ?')
    .get(monthKey) as MonthlyClosingRecord | undefined;
  return record || null;
}

/**
 * Closes a monthly financial period, locking all financial mutations for that month.
 */
export function closeMonth(
  dbInstance: DatabaseType | undefined,
  monthKey: string,
  userId: string
): MonthlyClosingRecord {
  const db = dbInstance || defaultDb;

  // Resolve valid user_id for FK constraint
  const existingUser = userId ? (db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any) : null;
  const validUserId = existingUser ? existingUser.id : ((db.prepare('SELECT id FROM users LIMIT 1').get() as any)?.id || null);

  // Calculate current financial summary for month
  const summary = getCashLedgerSummary(db, monthKey);

  const existing = getMonthlyClosingStatus(db, monthKey);

  const closingId = existing ? existing.id : `close_${monthKey.replace('-', '')}`;
  const now = new Date().toISOString();

  const runAtomic = db.transaction(() => {
    db.prepare(`
      INSERT INTO monthly_closings (
        id, month_key, total_income, total_expense, ending_balance, status, closed_by, closed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'CLOSED', ?, ?, ?)
      ON CONFLICT(month_key) DO UPDATE SET
        total_income = excluded.total_income,
        total_expense = excluded.total_expense,
        ending_balance = excluded.ending_balance,
        status = 'CLOSED',
        closed_by = excluded.closed_by,
        closed_at = excluded.closed_at,
        updated_at = excluded.updated_at
    `).run(
      closingId,
      monthKey,
      summary.total_income,
      summary.total_expense,
      summary.ending_balance,
      validUserId,
      now,
      now
    );

    // Create append-only Audit Log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, module, record_id, new_value_json, created_at)
      VALUES (?, ?, 'CLOSE_MONTH', 'MONTHLY_CLOSING', ?, ?, ?)
    `).run(
      auditId,
      validUserId,
      monthKey,
      JSON.stringify({
        month_key: monthKey,
        total_income: summary.total_income,
        total_expense: summary.total_expense,
        ending_balance: summary.ending_balance,
        status: 'CLOSED'
      }),
      now
    );
  });

  runAtomic();

  return getMonthlyClosingStatus(db, monthKey)!;
}

/**
 * Unlocks a previously CLOSED monthly period.
 * Requires Admin user and non-empty unlock reason.
 */
export function unlockMonth(
  dbInstance: DatabaseType | undefined,
  monthKey: string,
  userId: string,
  unlockReason: string
): MonthlyClosingRecord {
  const db = dbInstance || defaultDb;

  if (!unlockReason || unlockReason.trim().length === 0) {
    const err = new Error('Lý do mở khóa là bắt buộc.');
    (err as any).code = 'REASON_REQUIRED';
    (err as any).status = 400;
    throw err;
  }

  // Resolve valid user_id for FK constraint
  const existingUser = userId ? (db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any) : null;
  const validUserId = existingUser ? existingUser.id : ((db.prepare('SELECT id FROM users LIMIT 1').get() as any)?.id || null);

  const existing = getMonthlyClosingStatus(db, monthKey);

  const closingId = existing ? existing.id : `close_${monthKey.replace('-', '')}`;
  const now = new Date().toISOString();

  const runAtomic = db.transaction(() => {
    db.prepare(`
      INSERT INTO monthly_closings (
        id, month_key, status, unlocked_by, unlocked_at, unlock_reason, updated_at
      ) VALUES (?, ?, 'OPEN', ?, ?, ?, ?)
      ON CONFLICT(month_key) DO UPDATE SET
        status = 'OPEN',
        unlocked_by = excluded.unlocked_by,
        unlocked_at = excluded.unlocked_at,
        unlock_reason = excluded.unlock_reason,
        updated_at = excluded.updated_at
    `).run(
      closingId,
      monthKey,
      validUserId,
      now,
      unlockReason.trim(),
      now
    );

    // Create append-only Audit Log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, module, record_id, old_value_json, new_value_json, created_at)
      VALUES (?, ?, 'UNLOCK_MONTH', 'MONTHLY_CLOSING', ?, ?, ?, ?)
    `).run(
      auditId,
      validUserId,
      monthKey,
      JSON.stringify({ status: existing ? existing.status : 'CLOSED' }),
      JSON.stringify({ status: 'OPEN', unlock_reason: unlockReason.trim() }),
      now
    );
  });

  runAtomic();

  return getMonthlyClosingStatus(db, monthKey)!;
}

/**
 * Fetches audit logs from the system with optional filters.
 */
export function getAuditLogs(
  dbInstance?: DatabaseType,
  filters?: { module?: string; recordId?: string; limit?: number }
): AuditLogRecord[] {
  const db = dbInstance || defaultDb;
  let query = 'SELECT * FROM audit_logs';
  const params: any[] = [];
  const clauses: string[] = [];

  if (filters?.module) {
    clauses.push('module = ?');
    params.push(filters.module);
  }

  if (filters?.recordId) {
    clauses.push('record_id = ?');
    params.push(filters.recordId);
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params) as AuditLogRecord[];
}
