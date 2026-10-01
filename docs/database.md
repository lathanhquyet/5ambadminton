# DATABASE SCHEMA & RELATIONAL SPECIFICATION (V3.1 - CONFIRMED)

- **Database Engine**: SQLite 3
- **PRAGMAs**: `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`
- **Total Tables**: 21 Tables

---

## 1. TABLE DICTIONARY & RELATIONSHIPS

### 1. `users`
- Primary Key: `id` (TEXT)
- Fields: `username` (TEXT, UNIQUE), `password_hash` (TEXT), `role` (TEXT CHECK 'ADMIN'|'MEMBER'), `member_id` (TEXT FK -> `members.id`).

### 2. `members`
- Primary Key: `id` (TEXT)
- Fields: `full_name` (TEXT), `phone` (TEXT), `email` (TEXT), `member_type` (TEXT CHECK 'FIXED'|'VISITOR'), `status` (TEXT CHECK 'ACTIVE'|'SUSPENDED'|'INACTIVE'), `days_per_week` (INTEGER 0..7), `joined_date` (DATE), `notes` (TEXT).
- Index: `idx_members_type_status` (`member_type`, `status`).

### 3. `member_month_snapshots`
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT), `member_id` (TEXT FK -> `members.id`), `days_per_week` (INTEGER), `days_in_month` (INTEGER), `calculated_days` (INTEGER), `calculation_formula` (TEXT).
- Constraint: `UNIQUE(month_key, member_id)`.

### 4. `playing_sessions`
- Primary Key: `id` (TEXT)
- Fields: `session_date` (DATE, UNIQUE), `month_key` (TEXT), `status` (TEXT CHECK 'PLANNED'|'OPEN'|'COMPLETED'|'CANCELLED'), `total_players` (INTEGER), `shuttle_used` (INTEGER), `notes` (TEXT), `created_by` (TEXT FK -> `users.id`), `updated_by` (TEXT FK -> `users.id`).
- Index: `idx_sessions_month` (`month_key`).

### 5. `playing_session_members`
- Primary Key: `id` (TEXT)
- Fields: `session_id` (TEXT FK -> `playing_sessions.id` ON DELETE CASCADE), `member_id` (TEXT FK -> `members.id`), `attendance_status` (TEXT CHECK 'PRESENT'|'ABSENT'), `checked_at` (TIMESTAMP), `checked_by` (TEXT FK -> `users.id`).
- Constraint: `UNIQUE(session_id, member_id)`.
- Index: `idx_psm_session` (`session_id`).

### 6. `inventory_products`
- Primary Key: `id` (TEXT)
- Fields: `code` (TEXT, UNIQUE), `name` (TEXT), `pieces_per_tube` (INTEGER DEFAULT 12), `min_stock_alert` (INTEGER DEFAULT 24), `notes` (TEXT).

### 7. `inventory_transactions` (**SOURCE OF TRUTH FOR INVENTORY**)
- Primary Key: `id` (TEXT)
- Fields: `transaction_date` (DATE), `month_key` (TEXT), `product_id` (TEXT FK -> `inventory_products.id`), `transaction_type` (TEXT CHECK 'RECEIPT'|'USAGE'|'ADJUSTMENT'|'TRANSFER'|'REFUND'), `quantity_in_pieces` (INTEGER), `reference_type` (TEXT), `reference_id` (TEXT), `unit_price` (INTEGER), `total_amount` (INTEGER), `notes` (TEXT), `created_by` (TEXT FK -> `users.id`).
- Index: `idx_inv_tx_month` (`month_key`).

### 8. `inventory_monthly_balances` (**SNAPSHOT / CACHE ONLY**)
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT), `product_id` (TEXT FK -> `inventory_products.id`), `opening_stock_pieces` (INTEGER), `imported_pieces` (INTEGER), `used_pieces` (INTEGER), `adjusted_pieces` (INTEGER), `closing_stock_pieces` (INTEGER), `status` (TEXT CHECK 'OPEN'|'CLOSING'|'CLOSED').
- Constraint: `UNIQUE(month_key, product_id)`.

### 9. `fee_configs`
- Primary Key: `id` (TEXT)
- Fields: `fee_type` (TEXT CHECK 'FIXED_FUND'|'VISITOR_FEE'|'COURT_FEE'), `name` (TEXT), `calculation_method` (TEXT), `effective_from` (DATE), `effective_to` (DATE), `version` (INTEGER), `default_amount` (INTEGER), `notes` (TEXT).

### 10. `member_fees`
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT), `member_id` (TEXT FK -> `members.id`), `fee_config_id` (TEXT FK -> `fee_configs.id`), `fee_type` (TEXT), `original_amount` (INTEGER), `rounded_amount` (INTEGER), `paid_amount` (INTEGER), `remaining_amount` (INTEGER), `fee_status` (TEXT CHECK 'UNPAID'|'PARTIAL'|'PAID').
- Constraint: `UNIQUE(month_key, member_id, fee_type)`.
- Index: `idx_member_fees_month` (`month_key`).

### 11. `payments`
- Primary Key: `id` (TEXT)
- Fields: `payment_date` (DATE), `month_key` (TEXT), `member_id` (TEXT FK -> `members.id`), `original_amount` (INTEGER), `rounded_amount` (INTEGER), `payment_method` (TEXT CHECK 'CASH'|'BANK_TRANSFER'), `bank_tx_code` (TEXT), `notes` (TEXT), `created_by` (TEXT FK -> `users.id`).

### 12. `payment_allocations`
- Primary Key: `id` (TEXT)
- Fields: `payment_id` (TEXT FK -> `payments.id` ON DELETE CASCADE), `member_fee_id` (TEXT FK -> `member_fees.id`), `allocated_amount` (INTEGER).

### 13. `income_transactions`
- Primary Key: `id` (TEXT)
- Fields: `transaction_date` (DATE), `month_key` (TEXT), `category` (TEXT CHECK 'FIXED_FUND'|'VISITOR_FEE'|'OTHER_INCOME'), `description` (TEXT), `member_id` (TEXT FK -> `members.id`), `original_amount` (INTEGER), `rounded_amount` (INTEGER), `payment_method` (TEXT), `payment_id` (TEXT FK -> `payments.id`), `is_void` (INTEGER CHECK 0|1).
- Index: `idx_income_month` (`month_key`).

### 14. `expense_transactions`
- Primary Key: `id` (TEXT)
- Fields: `transaction_date` (DATE), `month_key` (TEXT), `category` (TEXT CHECK 'COURT_FEE'|'SHUTTLE_PURCHASE'|'OTHER_EXPENSE'), `description` (TEXT), `recipient` (TEXT), `original_amount` (INTEGER), `rounded_amount` (INTEGER), `payment_method` (TEXT), `reference_type` (TEXT), `reference_id` (TEXT), `is_void` (INTEGER CHECK 0|1).
- Index: `idx_expense_month` (`month_key`).

### 15. `shuttle_purchases`
- Primary Key: `id` (TEXT)
- Fields: `purchase_date` (DATE), `month_key` (TEXT), `product_id` (TEXT FK -> `inventory_products.id`), `supplier` (TEXT), `tubes_qty` (INTEGER), `pieces_qty` (INTEGER), `price_per_tube` (INTEGER), `total_amount` (INTEGER), `expense_transaction_id` (TEXT FK -> `expense_transactions.id`), `inventory_transaction_id` (TEXT FK -> `inventory_transactions.id`).

### 16. `court_fee_configs`
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT, UNIQUE), `price_per_day` (INTEGER), `total_days` (INTEGER), `total_courts` (INTEGER), `total_amount` (INTEGER), `expense_transaction_id` (TEXT FK -> `expense_transactions.id`).

### 17. `bank_accounts`
- Primary Key: `id` (TEXT)
- Fields: `bank_name` (TEXT), `account_number` (TEXT), `account_holder` (TEXT), `is_active` (INTEGER CHECK 0|1).

### 18. `monthly_closings`
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT, UNIQUE), `total_income` (INTEGER), `total_expense` (INTEGER), `ending_balance` (INTEGER), `inventory_summary_json` (TEXT), `status` (TEXT CHECK 'OPEN'|'CLOSING'|'CLOSED'), `closed_by` (TEXT FK -> `users.id`), `closed_at` (TIMESTAMP), `unlocked_by` (TEXT FK -> `users.id`), `unlocked_at` (TIMESTAMP), `unlock_reason` (TEXT).

### 19. `monthly_report_snapshots`
- Primary Key: `id` (TEXT)
- Fields: `month_key` (TEXT, UNIQUE), `snapshot_data_json` (TEXT), `generated_at` (TIMESTAMP).

### 20. `audit_logs`
- Primary Key: `id` (TEXT)
- Fields: `user_id` (TEXT FK -> `users.id`), `action` (TEXT), `module` (TEXT), `record_id` (TEXT), `old_value_json` (TEXT), `new_value_json` (TEXT), `ip_address` (TEXT).
- Index: `idx_audit_module_record` (`module`, `record_id`).

### 21. `session_visitor_fees`
- Primary Key: `id` (TEXT)
- Fields: `session_id` (TEXT FK -> `playing_sessions.id` ON DELETE CASCADE), `member_id` (TEXT FK -> `members.id`), `amount` (INTEGER DEFAULT 50000), `status` (TEXT CHECK 'UNPAID'|'PAID'), `income_transaction_id` (TEXT FK -> `income_transactions.id` ON DELETE SET NULL), `notes` (TEXT).
- Constraint: `UNIQUE(session_id, member_id)`.
- Indexes: `idx_svf_session` (`session_id`), `idx_svf_member` (`member_id`).

---

## 2. KEY RELATIONAL CHAINS

1. **Financial Chain**:  
   `member_fees` $\rightarrow$ `payment_allocations` $\leftarrow$ `payments` $\rightarrow$ `income_transactions`
2. **Inventory Chain**:  
   `shuttle_purchases` $\rightarrow$ `expense_transactions` + `inventory_transactions` (Type: `RECEIPT`)  
   `playing_sessions` $\rightarrow$ `inventory_transactions` (Type: `USAGE`)
3. **Session & Attendance Chain**:  
   `playing_sessions` $\rightarrow$ `playing_session_members` $\leftarrow$ `members`
4. **Visitor Fee Chain**:  
   `playing_sessions` $\rightarrow$ `session_visitor_fees` $\rightarrow$ `income_transactions`
