import { Database as DatabaseType } from 'better-sqlite3';
import { getDb, defaultDb } from './db';

export const runMigrations = (dbInstance?: DatabaseType) => {
  const db = dbInstance || defaultDb;

  db.exec(`
    -- 1. Users table
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MEMBER')),
        member_id TEXT UNIQUE REFERENCES members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Members table
    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        member_type TEXT NOT NULL CHECK(member_type IN ('FIXED', 'VISITOR')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
        days_per_week INTEGER DEFAULT 0 CHECK(days_per_week BETWEEN 0 AND 7),
        joined_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_members_type_status ON members(member_type, status);

    -- 3. Member Month Snapshots table
    CREATE TABLE IF NOT EXISTS member_month_snapshots (
        id TEXT PRIMARY KEY,
        month_key TEXT NOT NULL,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        days_per_week INTEGER NOT NULL,
        days_in_month INTEGER NOT NULL,
        calculated_days INTEGER NOT NULL,
        calculation_formula TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month_key, member_id)
    );

    -- 4. Playing Sessions table
    CREATE TABLE IF NOT EXISTS playing_sessions (
        id TEXT PRIMARY KEY,
        session_date DATE UNIQUE NOT NULL,
        month_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED', 'OPEN', 'COMPLETED', 'CANCELLED')),
        total_players INTEGER DEFAULT 0,
        shuttle_used INTEGER DEFAULT 0,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        updated_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_month ON playing_sessions(month_key);

    -- 5. Playing Session Members table
    CREATE TABLE IF NOT EXISTS playing_session_members (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES playing_sessions(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        attendance_status TEXT NOT NULL DEFAULT 'PRESENT' CHECK(attendance_status IN ('PRESENT', 'ABSENT')),
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checked_by TEXT REFERENCES users(id),
        UNIQUE(session_id, member_id)
    );
    CREATE INDEX IF NOT EXISTS idx_psm_session ON playing_session_members(session_id);

    -- 6. Inventory Products table
    CREATE TABLE IF NOT EXISTS inventory_products (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        pieces_per_tube INTEGER NOT NULL DEFAULT 12,
        min_stock_alert INTEGER DEFAULT 24,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Inventory Transactions table (SOURCE OF TRUTH)
    CREATE TABLE IF NOT EXISTS inventory_transactions (
        id TEXT PRIMARY KEY,
        transaction_date DATE NOT NULL,
        month_key TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES inventory_products(id),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('RECEIPT', 'USAGE', 'ADJUSTMENT', 'TRANSFER', 'REFUND')),
        quantity_in_pieces INTEGER NOT NULL,
        reference_type TEXT CHECK(reference_type IN ('PLAYING_SESSION', 'PURCHASE', 'MANUAL', 'CLOSING')),
        reference_id TEXT,
        unit_price INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_inv_tx_month ON inventory_transactions(month_key);

    -- 8. Inventory Monthly Balances table (SNAPSHOT / CACHE ONLY)
    CREATE TABLE IF NOT EXISTS inventory_monthly_balances (
        id TEXT PRIMARY KEY,
        month_key TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES inventory_products(id),
        opening_stock_pieces INTEGER NOT NULL DEFAULT 0,
        imported_pieces INTEGER NOT NULL DEFAULT 0,
        used_pieces INTEGER NOT NULL DEFAULT 0,
        adjusted_pieces INTEGER NOT NULL DEFAULT 0,
        closing_stock_pieces INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSING', 'CLOSED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month_key, product_id)
    );

    -- 9. Fee Configs table
    CREATE TABLE IF NOT EXISTS fee_configs (
        id TEXT PRIMARY KEY,
        fee_type TEXT NOT NULL CHECK(fee_type IN ('FIXED_FUND', 'VISITOR_FEE', 'COURT_FEE')),
        name TEXT NOT NULL,
        calculation_method TEXT NOT NULL CHECK(calculation_method IN ('EQUAL_SPLIT', 'BY_REGISTERED_DAYS', 'MANUAL', 'PER_SESSION')),
        effective_from DATE NOT NULL,
        effective_to DATE,
        version INTEGER NOT NULL DEFAULT 1,
        default_amount INTEGER DEFAULT 0,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Member Fees table
    CREATE TABLE IF NOT EXISTS member_fees (
        id TEXT PRIMARY KEY,
        month_key TEXT NOT NULL,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        fee_config_id TEXT REFERENCES fee_configs(id),
        fee_type TEXT NOT NULL CHECK(fee_type IN ('FIXED_FUND', 'VISITOR_FEE', 'OTHER')),
        original_amount INTEGER NOT NULL,
        rounded_amount INTEGER NOT NULL,
        paid_amount INTEGER NOT NULL DEFAULT 0,
        remaining_amount INTEGER NOT NULL,
        fee_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(fee_status IN ('UNPAID', 'PARTIAL', 'PAID')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month_key, member_id, fee_type)
    );
    CREATE INDEX IF NOT EXISTS idx_member_fees_month ON member_fees(month_key);

    -- 11. Payments table
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        payment_date DATE NOT NULL,
        month_key TEXT NOT NULL,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        original_amount INTEGER NOT NULL,
        rounded_amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER' CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')),
        bank_tx_code TEXT,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Payment Allocations table
    CREATE TABLE IF NOT EXISTS payment_allocations (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        member_fee_id TEXT NOT NULL REFERENCES member_fees(id) ON DELETE RESTRICT,
        allocated_amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Income Transactions table
    CREATE TABLE IF NOT EXISTS income_transactions (
        id TEXT PRIMARY KEY,
        transaction_date DATE NOT NULL,
        month_key TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('FIXED_FUND', 'VISITOR_FEE', 'OTHER_INCOME')),
        description TEXT NOT NULL,
        member_id TEXT REFERENCES members(id),
        original_amount INTEGER NOT NULL,
        rounded_amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER' CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')),
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1)),
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_income_month ON income_transactions(month_key);

    -- 14. Expense Transactions table
    CREATE TABLE IF NOT EXISTS expense_transactions (
        id TEXT PRIMARY KEY,
        transaction_date DATE NOT NULL,
        month_key TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('COURT_FEE', 'SHUTTLE_PURCHASE', 'OTHER_EXPENSE')),
        description TEXT NOT NULL,
        recipient TEXT,
        original_amount INTEGER NOT NULL,
        rounded_amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER' CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')),
        reference_type TEXT CHECK(reference_type IN ('SHUTTLE_PURCHASE', 'COURT_FEE', 'MANUAL')),
        reference_id TEXT,
        is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1)),
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_expense_month ON expense_transactions(month_key);

    -- 15. Shuttle Purchases table
    CREATE TABLE IF NOT EXISTS shuttle_purchases (
        id TEXT PRIMARY KEY,
        purchase_date DATE NOT NULL,
        month_key TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES inventory_products(id),
        supplier TEXT NOT NULL,
        tubes_qty INTEGER NOT NULL,
        pieces_qty INTEGER NOT NULL,
        price_per_tube INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        expense_transaction_id TEXT REFERENCES expense_transactions(id),
        inventory_transaction_id TEXT REFERENCES inventory_transactions(id),
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Court Fee Configs table
    CREATE TABLE IF NOT EXISTS court_fee_configs (
        id TEXT PRIMARY KEY,
        month_key TEXT UNIQUE NOT NULL,
        price_per_day INTEGER NOT NULL,
        total_days INTEGER NOT NULL,
        total_courts INTEGER NOT NULL DEFAULT 1,
        total_amount INTEGER NOT NULL,
        expense_transaction_id TEXT REFERENCES expense_transactions(id),
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Bank Accounts table
    CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY,
        bank_name TEXT NOT NULL,
        bank_bin TEXT DEFAULT '970436',
        account_number TEXT NOT NULL,
        account_holder TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration helper for existing table
  const bankCols = db.prepare("PRAGMA table_info(bank_accounts)").all() as any[];
  if (!bankCols.some(c => c.name === 'bank_bin')) {
    db.exec("ALTER TABLE bank_accounts ADD COLUMN bank_bin TEXT DEFAULT '970436'");
  }

  db.exec(`
    -- 18. Monthly Closings table
    CREATE TABLE IF NOT EXISTS monthly_closings (
        id TEXT PRIMARY KEY,
        month_key TEXT UNIQUE NOT NULL,
        total_income INTEGER NOT NULL DEFAULT 0,
        total_expense INTEGER NOT NULL DEFAULT 0,
        ending_balance INTEGER NOT NULL DEFAULT 0,
        inventory_summary_json TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSING', 'CLOSED')),
        closed_by TEXT REFERENCES users(id),
        closed_at TIMESTAMP,
        unlocked_by TEXT REFERENCES users(id),
        unlocked_at TIMESTAMP,
        unlock_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. Monthly Report Snapshots table
    CREATE TABLE IF NOT EXISTS monthly_report_snapshots (
        id TEXT PRIMARY KEY,
        month_key TEXT UNIQUE NOT NULL,
        snapshot_data_json TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 20. Audit Logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id TEXT NOT NULL,
        old_value_json TEXT,
        new_value_json TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_module_record ON audit_logs(module, record_id);

    -- 21. Session Visitor Fees table
    CREATE TABLE IF NOT EXISTS session_visitor_fees (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES playing_sessions(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL DEFAULT 50000,
        status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(status IN ('UNPAID', 'PAYMENT_REQUESTED', 'PAID')),
        income_transaction_id TEXT REFERENCES income_transactions(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, member_id)
    );
    CREATE INDEX IF NOT EXISTS idx_svf_session ON session_visitor_fees(session_id);
    CREATE INDEX IF NOT EXISTS idx_svf_member ON session_visitor_fees(member_id);

    -- 22. Telegram Settings table
    CREATE TABLE IF NOT EXISTS telegram_settings (
        id TEXT PRIMARY KEY,
        bot_token TEXT,
        chat_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database schema migrations executed successfully (22 tables).');
};

if (require.main === module) {
  runMigrations();
}
