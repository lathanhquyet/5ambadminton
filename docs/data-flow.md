# SYSTEM DATA FLOW SPECIFICATION

> **IMPORTANT**: Frontend React components are NOT a source of financial or inventory truth. All calculations, carry-forward balances, percentages, and metrics are computed by backend services and consumed read-only by the frontend.

---

## 1. MEMBER MANAGEMENT FLOW

```text
Admin Form (React)
  ↓ POST /api/v1/members
MemberController
  ↓ Validate input (days_per_week: 0–7, joined_date, member_type)
Member Repository / SQLite `members` Table
  ↓
Response (HTTP 201 Created)
```

---

## 2. SESSION & ATTENDANCE FLOW

```text
Admin Create Session Form (Multi-Select Members + Visitors)
  ↓ POST /api/v1/sessions
SessionController (Atomic db.transaction)
  ├─> 1. Insert row into `playing_sessions`
  ├─> 2. Insert rows into `playing_session_members` (INSERT OR IGNORE for uniqueness)
  ├─> 3. Add visitors to `session_visitor_fees` & `members` (if provided)
  └─> 4. Recount PRESENT total_players and update `playing_sessions.total_players`
  ↓
Response (HTTP 201 Created)
```

---

## 3. SHUTTLE INVENTORY FLOWS

### A. Shuttle Purchase (Mua cầu)
```text
Admin Purchase Form
  ↓ POST /api/v1/inventory/receipts
InventoryController (Atomic db.transaction)
  ├─> 1. Insert `expense_transactions` (Category: SHUTTLE_PURCHASE, Amount: tubes * price)
  └─> 2. Insert `inventory_transactions` (Type: RECEIPT, Quantity: tubes * 12 pieces)
  ↓
Response (HTTP 201 Created)
```

### B. Shuttle Usage (Sử dụng cầu trong buổi chơi)
```text
Admin Shuttle Usage Input
  ↓ PUT /api/v1/sessions/:id/shuttle-usage
InventoryService.recordSessionShuttleUsage
  ├─> Delta = newShuttleUsed - oldShuttleUsed
  ├─> If Delta > 0: Check stock >= Delta, Insert `inventory_transactions` (Type: USAGE, Quantity: -Delta)
  ├─> If Delta < 0: Insert `inventory_transactions` (Type: REFUND, Quantity: +|Delta|)
  └─> Update `playing_sessions.shuttle_used`
  ↓
(NO expense_transaction is created!)
```

### C. Session Cancellation Refund
```text
Admin Cancel Session
  ↓ POST /api/v1/sessions/:id/cancel
InventoryService.cancelPlayingSession
  ├─> Update `playing_sessions.status` = 'CANCELLED'
  └─> Insert `inventory_transactions` (Type: REFUND, Quantity: +shuttle_used)
  ↓
Response (HTTP 200 OK)
```

---

## 4. FIXED MEMBER FEE, DEBT & PAYMENT FLOW

```text
Monthly Fee Trigger
  ↓ POST /api/v1/fees/calculate-monthly
FeeEngine
  ├─> 1. Calculate Expected Days: Math.ceil(daysPerWeek * daysInMonth / 7)
  ├─> 2. Calculate Original Fee Amount
  ├─> 3. Apply ROUNDUP to 10,000 VND: Math.ceil(amount / 10000) * 10000
  └─> 4. Insert into `member_fees` (status: UNPAID, remaining = rounded_amount)
  ↓
Payment Recording
  ↓ POST /api/v1/payments
PaymentController
  ├─> 1. Check payment amount <= remaining_amount (Reject if overpaid with HTTP 400 PAYMENT_EXCEEDS_DEBT)
  ├─> 2. Insert row into `payments`
  ├─> 3. Insert row into `payment_allocations`
  ├─> 4. Update `member_fees` (paid_amount, remaining_amount, status)
  └─> 5. Insert row into `income_transactions` (Category: FIXED_FUND, payment_id)
  ↓
Cash Ledger
  └─> Aggregate `income_transactions` (`is_void = 0`) into total cash income
```

---

## 5. VISITOR FEE FLOW

```text
Visitor Added to Session
  ↓ POST /api/v1/sessions/:id/visitors
VisitorFeeService
  ├─> Insert member record (Type: VISITOR)
  ├─> Insert row into `session_visitor_fees` (amount = exact input, default 50,000)
  ├─> Add PRESENT row to `playing_session_members`
  └─> Update `playing_sessions.total_players`

Unpaid Visitor Fee:
  └─> Contributes to `visitorFeeDue` & `visitorFeeOutstanding`.
  └─> Does NOT enter `income_transactions` or Cash Ledger.

Paid Visitor Fee:
  ↓ POST /api/v1/sessions/visitor-fees/:feeId/pay
  ├─> Update `session_visitor_fees.status` = 'PAID'
  ├─> Create `income_transactions` (Category: VISITOR_FEE, amount = exact fee)
  └─> Link `income_transaction_id` to `session_visitor_fees`
  └─> Contributes to Cash Ledger total income.
```

---

## 6. FINANCIAL REPORT & ADMIN DASHBOARD FLOW

```text
SQLite Source Tables (`income_transactions`, `expense_transactions`, `session_visitor_fees`, `inventory_transactions`, `playing_sessions`, `playing_session_members`)
  ↓ Read-Only Queries
ReportService (`getMonthlyDashboardReport(monthKey)`)
  ├─> Calculate Opening Balance: Cumulative Income (< monthKey) - Cumulative Expense (< monthKey)
  ├─> Calculate Current Month Income Breakdown & Percentages
  ├─> Calculate Current Month Expense Breakdown & Percentages
  ├─> Calculate Visitor Fee Due, Collected, Outstanding & Cash Income
  └─> Calculate Activity Counters & Current Stock Source of Truth
  ↓
ReportController (`GET /api/v1/reports/monthly?month=YYYY-MM`)
  ↓ JSON Response (DTO)
Frontend `DashboardPage.tsx`
  └─> Render formatters (`formatCurrency`, `formatMonthDisplay`) — Zero recalculations!
```
