# TESTING STRATEGY & TEST SUITE ARCHITECTURE

---

## 1. TEST FRAMEWORK & EXECUTOR
- **Backend Test Framework**: Jest 29 (`backend/node_modules/jest`) with `supertest` for HTTP integration and in-memory SQLite (`better-sqlite3`).
- **Frontend Verification**: TypeScript compiler (`tsc`) and Vite bundler (`vite build`).

---

## 2. TEST FILE ARCHITECTURE (`backend/src/tests/`)

| Test Suite File | Coverage Scope | Test Count | Status |
| :--- | :--- | :---: | :---: |
| `phase1.test.ts` | Schema migration, auth login/me, member CRUD, expected days matrix | 11 | **PASS** |
| `phase2.test.ts` | Session CRUD, attendance total players, shuttle usage & cancellation refunds | 7 | **PASS** |
| `phase3.test.ts` | Fee Engine, Debt calculation, VietQR payload, payment allocation | 10 | **PASS** |
| `feeRounding10k.test.ts` | Fixed fund 10k rounding matrix (`ROUNDUP(amount, -4)`) | 1 | **PASS** |
| `financialReconciliation.test.ts` | Equal reconciliation: `member_fees` -> `payments` -> `allocations` -> `income` | 8 | **PASS** |
| `phase4.test.ts` | Cash Ledger, shuttle purchase, court fee, mid-month joiner | 10 | **PASS** |
| `phase4Reconciliation.test.ts` | Multi-month carry-forward, void consistency, closed month lock | 13 | **PASS** |
| `inventoryMenu.test.ts` | Manual inventory receipts, issues, adjustments, formatting | 7 | **PASS** |
| `visitorSession.test.ts` | Session-specific walk-in visitors, exact override fee, unpaid/paid income link | 8 | **PASS** |
| `deepAuditFullRegression.test.ts` | Multi-month operation simulation, relational integrity, stress sanity | 11 | **PASS** |
| `businessFormula.test.ts` | Expected days formula `Math.ceil(d*m/7)`, 1k rounding formula | 4 | **PASS** |
| `phase4_5.test.ts` | Clean test DB reset, atomic multi-member session creation, duplicate guards | 20 | **PASS** |
| `phase5AReport.test.ts` | Centralized report layer, breakdowns, visitor fee metrics, data isolation | 73 | **PASS** |
| `phase5B.dashboard.test.ts` | Admin Dashboard UI integration, month selector, zero data, formatting rules | 79 | **PASS** |
| **TOTAL** | **Full System Integration Test Suite** | **262** | **PASS (100%)** |

---

## 3. KEY TEST COMMANDS

Ensure PATH includes Node bin:
```bash
export PATH=/home/quyet-la/.nvm/versions/node/v20.20.2/bin:$PATH
```

- **Run all 262 backend tests**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npm test
  ```
- **Run specific test file**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npx jest src/tests/phase5B.dashboard.test.ts
  ```
- **Build frontend**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/frontend && npm run build
  ```
- **Build backend**:
  ```bash
  cd /home/quyet-la/dataD/VIBECODE/5ambadminton/backend && npm run build
  ```

---

## 4. VERIFICATION GATES BEFORE PROCEEDING
Every subsequent phase (e.g. Phase 5C) MUST satisfy:
- **FAIL = 0**
- **BLOCKED = 0**
- **Financial Reconciliation = PASS**
- **Inventory Source of Truth = PASS**
- **Report Layer Source of Truth = PASS**
- **100% Test Pass Rate across 262 system tests**
