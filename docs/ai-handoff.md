# AI HANDOFF — READ THIS FIRST

> **CRITICAL INSTRUCTION FOR THE NEXT AI AGENT**:
> Read this file in full BEFORE making any changes to the codebase. Do NOT guess file locations, do NOT alter verified business logic, do NOT bypass test gates, and do NOT jump ahead to Phase 5C or Phase 6 without explicit user direction.

---

## 1. CURRENT STATUS CHECKPOINT

| Phase | Description | Status | Test Results |
| :--- | :--- | :---: | :---: |
| **Phase 1** | Schema, Migrations, Auth & Member Logic | **PASS** | 11/11 PASS |
| **Phase 2** | Sessions, Attendance & Shuttle Usage | **PASS** | 7/7 PASS |
| **Phase 3** | Fee Engine, Debt, Payment Allocation & VietQR | **PASS** | 11/11 PASS |
| **Phase 3 Recon** | Financial Reconciliation (Fees -> Payments -> Income) | **PASS** | 8/8 PASS |
| **Phase 4** | Cash Ledger, Mid-Month Joiners & Shuttle Purchase | **PASS** | 25/25 PASS |
| **Phase 4 Recon** | Multi-Month Carry-Forward, Void & Immutability | **PASS** | 13/13 PASS |
| **Phase 4.5** | Test Database Reset & Create Session Member UX | **PASS** | 20/20 PASS |
| **Phase 5A** | Backend Centralized Read-Only Report Layer & APIs | **PASS** | 73/73 PASS |
| **Phase 5B Remediation**| Financial Operations, Category & Visitor Debt Status Remediation | **PASS** | 27/27 PASS (`phase5B.guiRemediation.test.ts`) |
| **Phase 5C Task 1** | Backend Public Saoke Report API (`GET /api/v1/public/saoke/monthly`) | **PASS** | 13/13 PASS (`phase5C.saoke.test.ts`) |
| **Phase 5C Remediation**| Public Saoke Outstanding Debtors & VietQR Payment | **PASS** | 9/9 PASS (`phase5C.publicSaokeDebtors.test.ts`) |
| **Phase 5C Task 4** | Telegram Alert & Admin Settings Remediation Audit | **PASS** | 10/10 PASS (`phase5C.telegramAlert.test.ts`) |
| **Phase 5C** | Public /saoke Transparency Page & VietQR | **PASS** | Task 1, 2, 3, Audit & Task 4 Remediation PASS |
| **Phase 6** | Monthly Closing UI, Audit Log, Export & Docker | **NOT STARTED** | - |

**Full System Test Gate**: **342 / 342 Tests PASS (100%)** across 20 test suites in `backend/src/tests/`.  
**Frontend Build Status**: `npm run build` in `frontend/` -> **PASS** (0 errors).  
**Backend Build Status**: `npm run build` in `backend/` -> **PASS** (0 errors).
**Financial Mutation from Telegram Alert**: **ZERO**
**Payment Webhook**: **NOT IMPLEMENTED**
**Automatic Payment Confirmation**: **NOT IMPLEMENTED**

---

## 2. IF YOU ARE A NEW AI AGENT (STEP-BY-STEP WORKFLOW)

Follow this exact step sequence before writing any code:

1. **STEP 1**: Read [`docs/ai-handoff.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/ai-handoff.md) (This file).
2. **STEP 2**: Read [`docs/phase-status.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/phase-status.md) to confirm completed checkpoints.
3. **STEP 3**: Read [`docs/business-rules.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/business-rules.md) to understand exact mathematical formulas, rounding rules, and constraints.
4. **STEP 4**: Read [`docs/data-flow.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/data-flow.md) to understand data flows and sources of truth.
5. **STEP 5**: Read [`docs/decision-log.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/decision-log.md) to review past technical decisions.
6. **STEP 6**: Read [`docs/next-steps.md`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/docs/next-steps.md) to confirm the ONLY allowed next action (**Phase 5C — Public /saoke**).
7. **STEP 7**: Run `export PATH=/home/quyet-la/.nvm/versions/node/v20.20.2/bin:$PATH && npm test` inside `backend/` to verify all 262 tests pass on your machine.
8. **STEP 8**: **NEVER modify financial engines, business formulas, or database schemas** unless a test explicitly proves a bug.
9. **STEP 9**: **NEVER recalculate financial data in React**. Frontend components MUST use the Phase 5A Report API (`GET /api/v1/reports/monthly?month=YYYY-MM`) as the single source of truth.
10. **STEP 10**: Execute ONLY the assigned Phase/task requested by the user.

---

## 3. PROJECT OVERVIEW & TECH STACK

- **Application**: **Quỹ Cầu Lông 5AM — RISE & SHINE (V3.1)**
- **Target**: Badminton club fund, member attendance, shuttle inventory, financial ledger, and public transparency portal.
- **Frontend**: React (v18+) + Vite + TypeScript + TailwindCSS (`frontend/`).
- **Backend**: Node.js + Express + TypeScript (`backend/`).
- **Database**: SQLite in WAL Mode with foreign keys enabled (`backend/src/database/`).
- **Node Version**: Node `v20.20.2` (located at `/home/quyet-la/.nvm/versions/node/v20.20.2/bin`).

---

## 4. SOURCES OF TRUTH & ARCHITECTURE

1. **Inventory Source of Truth**: Bảng `inventory_transactions` là nguồn chân lý duy nhất. `inventory_monthly_balances` chỉ là snapshot/cache.
2. **Report Source of Truth**: `reportService.ts` & `GET /api/v1/reports/monthly` là nguồn chân lý duy nhất cho Admin Dashboard và Public `/saoke`.
3. **Frontend Rules**: Frontend **tuyệt đối không tự tính lại** `totalIncome`, `totalExpense`, `openingBalance`, `endingBalance`, `percentages`, hay `outstanding`. Frontend chỉ format và render DTO từ backend.
4. **Rounding Rules**:
   - **Fixed Member Fee**: `ROUNDUP(amount, -4)` (làm tròn lên hàng **10,000 VND**).
   - **Financial Ledger & Cash Income**: `ROUNDUP(amount, -3)` (làm tròn lên hàng **1,000 VND**).
   - **Visitor Fee**: Exact Admin input (Ví dụ: `55,555` giữ nguyên `55.555 ₫`, **tuyệt đối không làm tròn**).

---

## 5. PROTECTED AREAS — DO NOT ALTER WITHOUT APPROVAL

The following core modules are battle-tested with 262 passing tests. Do NOT modify their logic during UI tasks:

- [`backend/src/services/feeEngine.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/services/feeEngine.ts) (Fixed fee calculation, 10k rounding, month locking guard)
- [`backend/src/services/cashLedgerService.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/services/cashLedgerService.ts) (Cash ledger, carry forward, court fee, shuttle purchase)
- [`backend/src/services/inventoryService.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/services/inventoryService.ts) (Stock balance, receipt, usage, refund on cancellation)
- [`backend/src/services/visitorFeeService.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/services/visitorFeeService.ts) (Visitor fee due/collected, exact amount, paid income link)
- [`backend/src/services/reportService.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/services/reportService.ts) (Centralized read-only report generator)
- [`backend/src/database/migrate.ts`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/backend/src/database/migrate.ts) (21 database tables & index definitions)

---

## 6. IMPORTANT FILE MAP

### Backend (`backend/src/`)
- `app.ts`: Express application setup, CORS, router mounts (`/auth`, `/members`, `/sessions`, `/inventory`, `/fees`, `/debts`, `/payments`, `/transactions`, `/reports`).
- `database/migrate.ts`: SQLite table schemas (21 tables) and indexes.
- `database/seed.ts`: Default seed (Admin user `admin`/`admin123`, Default shuttle product `SHUTTLE_TC77`).
- `database/resetTestDb.ts`: Clean test database reset utility (`npm run db:reset-test`).
- `services/feeEngine.ts`: Fixed fund fee engine, expected days calculation `Math.ceil(days * daysInMonth / 7)`, 10k rounding.
- `services/cashLedgerService.ts`: Cumulative carry-forward cash ledger calculation, transaction recording, void handling.
- `services/inventoryService.ts`: Stock summary from `inventory_transactions` source of truth, session shuttle usage & refunds.
- `services/visitorFeeService.ts`: Session visitor fee management, paid/unpaid tracking, exact override support.
- `services/reportService.ts`: Centralized monthly report aggregate generator (`getMonthlyDashboardReport`).
- `controllers/reportController.ts`: Handles `GET /api/v1/reports/monthly` with `YYYY-MM` validation.
- `routes/reportRoutes.ts`: Express route enforcing JWT auth and `ADMIN` role.
- `tests/*.test.ts`: 14 test suites covering all system phases and reconciliations.

### Frontend (`frontend/src/`)
- `App.tsx`: Main SPA entry layout, Top Navbar, Tab navigation (`dashboard`, `members`, `sessions`, `inventory`, `fees`), Auth check.
- `api/client.ts`: Axios client instance with Bearer JWT request interceptor.
- `api/reportApi.ts`: `getMonthlyReport(monthKey)` API helper.
- `types/report.ts`: TypeScript DTO interfaces for monthly report data.
- `utils/formatters.ts`: `formatCurrency` (preserves exact values & negative sign) and `formatMonthDisplay`.
- `pages/DashboardPage.tsx`: Admin Dashboard view with skeleton loading state, Vietnamese error retry state, month selector, and report cards.
- `components/dashboard/*`: Component cards for Financial Summary, Income Breakdown, Expense Breakdown, Visitor Fee Summary, Activity & Inventory Summary, and Month Selector.

---

## 7. TEST COMMANDS & EXECUTION SCHEME

Set PATH to include Node bin before running commands:
```bash
export PATH=/home/quyet-la/.nvm/versions/node/v20.20.2/bin:$PATH
```

- **Run all backend tests**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npm test
  ```
- **Run Phase 5B Dashboard test suite**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npx jest src/tests/phase5B.dashboard.test.ts
  ```
- **Reset test database**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npm run db:reset-test
  ```
- **Build backend**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npm run build
  ```
- **Build frontend**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/frontend && npm run build
  ```

---

## 8. ENVIRONMENT & CONFIGURATION

- Node version: `v20.20.2`
- Database: SQLite database file (Memory for Jest tests, default SQLite DB for dev/prod).
- Required Environment Variables (defined in `.env.example`):
  - `PORT=3001`
  - `JWT_SECRET=super_secret_jwt_key_5am_badminton`
  - `CORS_ORIGIN=*`

---

## 9. KNOWN LIMITATIONS & DISCREPANCIES

- **None confirmed**. All 262 tests across 14 test suites pass with 0 failures, 0 warnings, and 0 memory leaks.

---

## 10. NEXT ALLOWED ACTION

**Phase 5C — Public /saoke Transparency Page & QR Share**.  
Do NOT attempt Phase 6 before Phase 5C is approved and verified.
