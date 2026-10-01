# PROJECT OVERVIEW — QUỸ CẦU LÔNG 5AM (RISE & SHINE - V3.1)

## 1. System Purpose & Core Objective
**Quỹ Cầu Lông 5AM — RISE & SHINE** is a specialized financial, inventory, attendance, and reporting management system tailored for badminton clubs. It provides complete transparency into club funds, member fees, court expenses, shuttlecock inventory movements, visitor fees, and financial balances.

## 2. Key Target Audience & Roles
- **Admin**: Full administrative control over member management, session scheduling, attendance check-ins, court fee configurations, shuttle purchases, manual inventory movements, visitor fee tracking, and monthly closings.
- **Member / Public**: Read-only access to transparency financial reports (`/saoke`), session attendance histories, and VietQR payment codes.

## 3. Core Modules & Functionality
1. **Auth & RBAC**: JWT-based authentication supporting `ADMIN` and `MEMBER` roles with password hashing via `bcryptjs`.
2. **Member Management**: Tracks `FIXED` and `VISITOR` members, days per week registered (0–7), expected playing days calculation, and member status (`ACTIVE`, `SUSPENDED`, `INACTIVE`).
3. **Session & Attendance Management**: Creation of playing sessions (`PLANNED`, `OPEN`, `COMPLETED`, `CANCELLED`), fast checkbox attendance, present player counts, atomic multi-member session creation, duplicate attendance prevention, and shuttle refunds on session cancellation.
4. **Shuttle Inventory Management**: `inventory_transactions` as single source of truth for stock receipts, usage, adjustments, transfers, and refunds. Shuttle usage does not create expense transactions; shuttle purchases atomically create an expense transaction and an inventory receipt.
5. **Fee Engine & Debt Management**: Monthly fixed fee calculation using `Math.ceil(days * daysInMonth / 7)` and ROUNDUP to 10,000 VND; Debt tracking (`Required Fee = Allocated Payment + Remaining Debt`), multi-payment allocations, and rejection of overpayments (`PAYMENT_EXCEEDS_DEBT`).
6. **Visitor Fee Management**: Session-specific walk-in visitor fees with default 50,000 VND or exact admin overrides (preserved without rounding). Unpaid visitor fees stay due/outstanding only; paid visitor fees generate single `VISITOR_FEE` income transactions.
7. **Cash Ledger & Mid-Month Joiners**: Cumulative carry-forward balance (`Opening = Previous Income - Previous Expense`), mid-month joiner manual contributions (`OTHER_INCOME`), expense category tracking (`COURT_FEE`, `SHUTTLE_PURCHASE`, `OTHER_EXPENSE`), and transaction voiding.
8. **Monthly Closing & Lock Guard**: Month locking protocol (`OPEN`, `CLOSING`, `CLOSED`). Prohibited writes to closed months return HTTP 403 `MONTH_CLOSED`. Historical immutability ensures configuration changes never alter past closed months.
9. **Centralized Report Layer & Admin Dashboard**: Read-only Report Service (`reportService.ts`) as single source of truth for financial overview, category breakdowns, visitor fee metrics, and activity counters. Admin Dashboard UI in React with zero frontend financial recalculations.

## 4. Tech Stack Summary
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (`frontend/`).
- **Backend**: Node.js + Express + TypeScript (`backend/`).
- **Database**: SQLite in WAL Mode with foreign key constraints enabled.
- **Testing**: Jest + Supertest (14 test suites, 262/262 passing tests).
