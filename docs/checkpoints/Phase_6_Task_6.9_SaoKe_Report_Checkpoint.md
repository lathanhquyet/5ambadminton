# PHASE 6 — TASK 6.9 CHECKPOINT REPORT

**Task**: 6.9 Sao Kê Reports & Statistics  
**Project**: Quỹ Cầu Lông 5AM – RISE & SHINE  
**Date**: 2026-10-01  
**Status**: COMPLETE  

---

## 1. SCOPE & IMPLEMENTATION SUMMARY

Task 6.9 added a read-only **BÁO CÁO & THỐNG KÊ CHI TIẾT** section to the `/saoke` page ([`PublicSaokePage.tsx`](file:///home/quyet-la/dataD/VIBECODE/5ambadminton/frontend/src/pages/PublicSaokePage.tsx)), featuring 4 analytical reports:

1. **Report #1 — Danh Sách Đóng Quỹ (Fund Payment Report)**:
   - Monthly & Yearly filter.
   - Aggregate sum of confirmed/paid funds (`rounded_amount` from `income_transactions` where `is_void = 0`, including confirmed `VISITOR_FEE` payments).
   - Excludes UNPAID fees and unconfirmed visitor requests.
   - Sorted `paid_amount DESC, full_name ASC`.
   - Summary cards: `Tổng tiền đã thu`, `Số thành viên đã đóng`.

2. **Report #2 — Danh Sách Khoản Chi (Expense Report)**:
   - Monthly & Yearly filter.
   - Categorized by `COURT_FEE` (Phí sân), `SHUTTLE_PURCHASE` (Phí cầu), and `OTHER_EXPENSE` (Phí khác) from `expense_transactions`.
   - Sorted `total_amount DESC`.
   - Summary card: `Tổng chi phí`.

3. **Report #3 — Thống Kê Số Buổi Chơi Của Từng Thành Viên (Member Attendance Report)**:
   - Monthly & Yearly filter.
   - Distinct sessions attended count (`COUNT(DISTINCT session_id)`) per member across Fixed and Visitor members. Max 1 count per member per session.
   - Sorted `session_count DESC, full_name ASC`.
   - Summary cards: `Tổng lượt tham gia`, `Số thành viên tham gia`.

4. **Report #4 — Thống Kê Số Quả Cầu Sử Dụng (Shuttle Usage Report)**:
   - `DAILY` (for selected Month), `MONTHLY` (for selected Year), or `YEARLY` breakdown.
   - Actual shuttle usage (`quantity_in_pieces` from `inventory_transactions` where `transaction_type = 'USAGE'`). Excludes receipts and opening stock.
   - Sorted `shuttle_pieces DESC, period_label DESC`.
   - Summary card: `Tổng số quả cầu đã sử dụng` (formatted as tubes and pieces).

---

## 2. CORE ARCHITECTURAL CONSTRAINTS PRESERVED

- **100% READ-ONLY**: Report API endpoints and UI contain ZERO mutation actions.
- **Zero Financial Rule Changes**: Financial Engine, Visitor Fee per-session model, Fixed Member payment, Monthly Closing, Session Lock, and Inventory Reconciliation remain 100% untouched.
- **Backend Aggregation**: Uses SQL `GROUP BY` and `SUM` for high efficiency.
- **Date & Timezone**: Filter defaults to current Month/Year in `Asia/Ho_Chi_Minh` timezone.
- **Closed Month Access**: Read & export functions work seamlessly on closed months.

---

## 3. COMPREHENSIVE TEST RESULTS

```text
Previous Baseline:
385/385 PASS (25 test suites)

New Tests Added (saokeReports.test.ts):
5/5 PASS

Final Test Results:
390/390 PASS (26 test suites)
```

---

## 4. BUILD VERIFICATION

```text
Backend Build:  PASS (npm run build)
Frontend Build: PASS (npm run build)
```
