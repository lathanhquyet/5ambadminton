# ARCHITECTURAL & BUSINESS DECISION LOG

---

### DECISION 001: SQLite in WAL Mode with Foreign Keys Enabled
- **Date**: 2026-09-01
- **Decision**: Use single-file SQLite database with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
- **Reason**: Simplifies deployment topology for small-to-medium badminton club funds while guaranteeing strict ACID transactional safety and relational integrity.
- **Impact**: Zero external database server overhead; robust file-based backups.

---

### DECISION 002: Inventory Source of Truth
- **Date**: 2026-09-05
- **Decision**: `inventory_transactions` table is the SINGLE SOURCE OF TRUTH for stock. `inventory_monthly_balances` is only a snapshot/cache.
- **Reason**: Prevents stock drift and eliminates race conditions.
- **Impact**: All stock calculations dynamically query `SUM(quantity_in_pieces)` from `inventory_transactions`.

---

### DECISION 003: Shuttle Accounting Separation (Purchase vs Usage)
- **Date**: 2026-09-08
- **Decision**: Shuttle purchases create an expense transaction and an inventory receipt. Shuttle usage during sessions creates an inventory usage transaction ONLY, without creating cash expense transactions.
- **Reason**: Prevents double-counting expense (once when buying shuttle tubes, and again when playing with them).
- **Impact**: Cash ledger reflects actual cash outflow when purchasing shuttles. Session usage tracks physical shuttle consumption only.

---

### DECISION 004: Centralized Read-Only Report Service & No Frontend Recalculation
- **Date**: 2026-09-28 (Phase 5A & 5B)
- **Decision**: Create backend `reportService.ts` (`GET /api/v1/reports/monthly`) as the single source of truth. Frontend React components MUST NOT recalculate financial totals, percentages, carry-forwards, or balances.
- **Reason**: Prevents frontend calculation bugs, inconsistent percentages, or mismatched financial summaries between pages/public views.
- **Impact**: Single unified backend report logic used by Admin Dashboard and future Public `/saoke`.

---

### DECISION 005: Fixed Member Fee 10,000 VND Rounding
- **Date**: 2026-09-29 (Phase 4.5)
- **Decision**: Apply `ROUNDUP(amount, -4)` (làm tròn lên hàng **10,000 VND**) for fixed fund member fees.
- **Reason**: Standardizes club monthly member dues into clean 10k multiples.
- **Impact**: Fee formula: `Math.ceil((daysPerWeek * daysInMonth) / 7)` $\rightarrow$ Original Fee $\rightarrow$ `Math.ceil(amount / 10000) * 10000`.

---

### DECISION 006: Visitor Fee Exact Override (No Rounding)
- **Date**: 2026-09-29 (Phase 4.5)
- **Decision**: Preserve exact admin-entered visitor fee amounts (e.g. 55,555 VND stays 55,555 VND) without applying any rounding.
- **Reason**: Admin may charge custom exact session amounts for visitors.
- **Impact**: `session_visitor_fees` stores exact integer; UI formats exact values (e.g. `55.555 ₫`).

---

### DECISION 007: Rejection of Overpayments (No Overpaid Tracking)
- **Date**: 2026-09-12 (Phase 3)
- **Decision**: Reject payment transactions where `amount > remaining_amount` with HTTP 400 `PAYMENT_EXCEEDS_DEBT`.
- **Reason**: The system does not support tracking overpaid credit balances.
- **Impact**: Members pay exact due or partial payment.

---

### DECISION 008: Month Locking Protocol & Historical Immutability
- **Date**: 2026-09-18 (Phase 3 & 4)
- **Decision**: Prohibit any write operations (`INSERT`, `UPDATE`, `DELETE`) targeting closed months (`monthly_closings.status = 'CLOSED'`), returning HTTP 403 `MONTH_CLOSED`. Current configuration changes must never alter closed month historical records.
- **Reason**: Guarantees accounting auditability and historical immutability.
- **Impact**: Past closed months remain untouched even when member parameters or fee configs change in the future.
