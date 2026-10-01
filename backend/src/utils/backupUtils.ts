import fs from 'fs';
import path from 'path';
import { Database as DatabaseType } from 'better-sqlite3';
import Database from 'better-sqlite3';
import { defaultDb } from '../database/db';

export interface IntegrityCheckResult {
  ok: boolean;
  pragmaResult: string;
  tableCount: number;
  criticalTables: string[];
  missingTables: string[];
}

const CRITICAL_TABLES = [
  'users',
  'members',
  'playing_sessions',
  'inventory_products',
  'inventory_transactions',
  'fee_configs',
  'member_fees',
  'payments',
  'payment_allocations',
  'income_transactions',
  'expense_transactions',
  'monthly_closings',
  'session_visitor_fees',
  'audit_logs'
];

/**
 * Executes SQLite PRAGMA integrity_check and checks critical table presence.
 */
export function verifyDatabaseIntegrity(dbInstance?: DatabaseType): IntegrityCheckResult {
  const db = dbInstance || defaultDb;

  // 1. Run PRAGMA integrity_check
  const result = db.prepare('PRAGMA integrity_check;').get() as { integrity_check?: string } | string;
  const pragmaResult = typeof result === 'string' ? result : (result.integrity_check || 'ok');

  // 2. Query existing tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const existingTableNames = new Set(tables.map((t) => t.name));

  const missingTables = CRITICAL_TABLES.filter((tbl) => !existingTableNames.has(tbl));

  const ok = pragmaResult === 'ok' && missingTables.length === 0;

  return {
    ok,
    pragmaResult,
    tableCount: existingTableNames.size,
    criticalTables: CRITICAL_TABLES,
    missingTables
  };
}

/**
 * Performs online SQLite database backup using better-sqlite3 .backup() method.
 */
export async function backupDatabase(
  dbInstance?: DatabaseType,
  destPath?: string
): Promise<string> {
  const db = dbInstance || defaultDb;
  const targetPath =
    destPath ||
    path.join(
      process.cwd(),
      'backups',
      `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    );

  const backupDir = path.dirname(targetPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  await db.backup(targetPath);
  return targetPath;
}

/**
 * Restores a SQLite database file and verifies integrity of target database.
 */
export function restoreDatabase(
  backupFilePath: string,
  targetDbPath: string
): IntegrityCheckResult {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`File backup không tồn tại: ${backupFilePath}`);
  }

  // Copy backup file over target db path
  fs.copyFileSync(backupFilePath, targetDbPath);

  // Open restored database instance and verify integrity
  const restoredDb = new Database(targetDbPath);
  try {
    const integrity = verifyDatabaseIntegrity(restoredDb);
    return integrity;
  } finally {
    restoredDb.close();
  }
}
