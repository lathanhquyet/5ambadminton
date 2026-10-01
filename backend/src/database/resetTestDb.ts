import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from './db';
import { runSeed } from './seed';

export function resetTestDatabase(dbInstance?: DatabaseType): void {
  const db = dbInstance || defaultDb;

  // Turn foreign keys off temporarily for table cleanup
  db.pragma('foreign_keys = OFF');

  const cleanupTx = db.transaction(() => {
    db.prepare('DELETE FROM session_visitor_fees').run();
    db.prepare('DELETE FROM payment_allocations').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM member_fees').run();
    db.prepare('DELETE FROM fee_configs').run();
    db.prepare('DELETE FROM member_month_snapshots').run();
    db.prepare('DELETE FROM expense_transactions').run();
    db.prepare('DELETE FROM income_transactions').run();
    db.prepare('DELETE FROM shuttle_purchases').run();
    db.prepare('DELETE FROM court_fee_configs').run();
    db.prepare('DELETE FROM inventory_transactions').run();
    db.prepare('DELETE FROM inventory_monthly_balances').run();
    db.prepare('DELETE FROM playing_session_members').run();
    db.prepare('DELETE FROM playing_sessions').run();
    db.prepare('DELETE FROM members').run();
    db.prepare('DELETE FROM monthly_closings').run();
    db.prepare('DELETE FROM monthly_report_snapshots').run();
    db.prepare('DELETE FROM audit_logs').run();
  });

  cleanupTx();

  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');

  // Re-seed essential defaults (admin user, default shuttle product)
  runSeed(db);
}

if (require.main === module) {
  resetTestDatabase();
  console.log('Test Database reset successfully to clean baseline state.');
}
