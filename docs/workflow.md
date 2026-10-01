# END-TO-END BUSINESS WORKFLOW SPECIFICATIONS

---

## WORKFLOW 1: Create Member
- **Input**: `full_name`, `phone`, `email`, `member_type` ('FIXED' | 'VISITOR'), `days_per_week` (0–7), `joined_date`.
- **API**: `POST /api/v1/members`
- **Service**: Member Validation Guard.
- **Database**: Insert into `members`.
- **Output**: Member object with generated `id`.
- **Validation**: `days_per_week` between 0 and 7; `joined_date` required.

---

## WORKFLOW 2: Create Session (Without Members)
- **Input**: `session_date` (YYYY-MM-DD), `notes`.
- **API**: `POST /api/v1/sessions`
- **Service**: Month lock guard (`assertMonthNotClosed`).
- **Database**: Insert into `playing_sessions` with `status = 'OPEN'`, `total_players = 0`.
- **Output**: Playing session object.

---

## WORKFLOW 3: Create Session With Members & Visitors (Atomic)
- **Input**: `session_date`, `member_ids` (string array), optional `visitor` / `visitors` list.
- **API**: `POST /api/v1/sessions`
- **Service**: `db.transaction()` atomic block.
- **Database**:
  1. Insert into `playing_sessions`.
  2. Insert distinct members into `playing_session_members` (`INSERT OR IGNORE`).
  3. Add visitors to `session_visitor_fees` & `members`.
  4. Recount PRESENT total_players.
- **Error Condition**: If `session_date` exists, transaction rolls back cleanly with HTTP 400 `DUPLICATE_SESSION_DATE`.

---

## WORKFLOW 4: Add / Update Member Attendance After Session Creation
- **Input**: `session_id`, `member_id`, `attendance_status` ('PRESENT' | 'ABSENT').
- **API**: `POST /api/v1/sessions/:id/attendance`
- **Service**: Cancelled session check + month lock guard.
- **Database**: UPSERT into `playing_session_members`, update `playing_sessions.total_players`.
- **Error Condition**: Returns HTTP 400 `SESSION_CANCELLED` if session is cancelled.

---

## WORKFLOW 5: Add Walk-in Visitor to Session
- **Input**: `session_id`, `full_name`, `phone`, optional `amount` (default 50,000), `is_paid` (boolean).
- **API**: `POST /api/v1/sessions/:id/visitors`
- **Service**: `addVisitorToSession` in `visitorFeeService.ts`.
- **Database**: Insert into `members` (type 'VISITOR'), insert `session_visitor_fees`, insert `playing_session_members`.
- **Side Effect**: If `is_paid = true`, creates `income_transactions` (Category `VISITOR_FEE`) and links `income_transaction_id`.

---

## WORKFLOW 6: Mark Visitor Fee as Paid (Thu Sau)
- **Input**: `feeId`, `payment_method` ('CASH' | 'BANK_TRANSFER'), `notes`.
- **API**: `POST /api/v1/sessions/visitor-fees/:feeId/pay`
- **Service**: `markVisitorFeePaid` in `visitorFeeService.ts`.
- **Database**: Update `session_visitor_fees.status = 'PAID'`, insert `income_transactions`.
- **Idempotency**: Retrying with same `feeId` returns existing income record without double counting.

---

## WORKFLOW 7: Member Payment & Allocation (No Overpayment)
- **Input**: `member_id`, `payment_date`, `month_key`, `amount`, `payment_method`, `bank_tx_code`.
- **API**: `POST /api/v1/payments`
- **Service**: Overpayment Check (`amount > remaining_amount`).
- **Database**: Insert `payments`, insert `payment_allocations`, update `member_fees`, insert `income_transactions`.
- **Error Condition**: If amount > remaining debt, fails with HTTP 400 `PAYMENT_EXCEEDS_DEBT`.

---

## WORKFLOW 8: Shuttle Purchase
- **Input**: `purchaseDate`, `monthKey`, `productId`, `supplier`, `tubesQty`, `pricePerTube`.
- **API**: `POST /api/v1/inventory/receipts`
- **Service**: Atomic Purchase Transaction.
- **Database**: Insert `expense_transactions` (Category `SHUTTLE_PURCHASE`), insert `inventory_transactions` (Type `RECEIPT`, pieces = tubes * 12), insert `shuttle_purchases`.

---

## WORKFLOW 9: Shuttle Usage in Session
- **Input**: `session_id`, `shuttle_used`.
- **API**: `PUT /api/v1/sessions/:id/shuttle-usage`
- **Service**: `recordSessionShuttleUsage`.
- **Database**: Insert `inventory_transactions` (Type `USAGE`, quantity = -delta), update `playing_sessions.shuttle_used`.
- **Constraint**: Zero cash expense created.

---

## WORKFLOW 10: Cancel Playing Session
- **Input**: `session_id`.
- **API**: `POST /api/v1/sessions/:id/cancel`
- **Service**: `cancelPlayingSession`.
- **Database**: Update `playing_sessions.status = 'CANCELLED'`, insert `inventory_transactions` (Type `REFUND`, quantity = +shuttle_used).

---

## WORKFLOW 11: Monthly Closing Protocol
- **Input**: `monthKey`, action ('LOCK' | 'UNLOCK'), `reason` (for unlock).
- **API**: `POST /api/v1/closing/lock`, `POST /api/v1/closing/unlock`
- **Database**: Update `monthly_closings.status` ('OPEN' | 'CLOSED'), write `audit_logs`.
- **Guard**: All future write operations targeting `CLOSED` month return HTTP 403 `MONTH_CLOSED`.

---

## WORKFLOW 12: Report Generation (Backend Layer)
- **Input**: `month` (YYYY-MM).
- **API**: `GET /api/v1/reports/monthly?month=YYYY-MM`
- **Service**: `getMonthlyDashboardReport` in `reportService.ts`.
- **Database**: Read-only queries to aggregate financial totals, breakdowns, visitor fees, and activity.
- **Constraint**: Zero mutations.

---

## WORKFLOW 13: Admin Dashboard UI
- **Input**: Admin select month `YYYY-MM`.
- **Frontend**: `DashboardPage.tsx` calls `getMonthlyReport(monthKey)`.
- **UI Render**: Formats currency and months without client-side recalculation.
