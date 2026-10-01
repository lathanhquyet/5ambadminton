# BADMINTON FUND MANAGEMENT SYSTEM - BUSINESS RULES & LOGIC (V3.1 - CONFIRMED)

Tài liệu này quy định chi tiết toàn bộ các quy tắc nghiệp vụ, công thức toán học và ràng buộc dữ liệu của hệ thống **Quỹ Cầu Lông 5AM — RISE & SHINE** đã được xác minh chính thức.

---

## 1. NGUYÊN TẮC BẮT BUỘC (CORE PRINCIPLES)

1. **Công nghệ Thống nhất**:
   - Backend: Node.js + Express + TypeScript
   - Frontend: React + Vite + TypeScript + TailwindCSS
   - Database: SQLite (WAL mode, Foreign Keys Enabled)
2. **Nguồn Chân lý Kho (Inventory Source of Truth)**:
   Bảng `inventory_transactions` là **SOURCE OF TRUTH** duy nhất để tính toán tồn kho thực tế. Bảng `inventory_monthly_balances` chỉ là snapshot/cache phụ trợ.
3. **Nguồn Chân lý Báo cáo (Report Source of Truth)**:
   `reportService.ts` & `GET /api/v1/reports/monthly` là **SOURCE OF TRUTH** duy nhất cho báo cáo tài chính và Admin Dashboard. Frontend **tuyệt đối không tự tính lại** `totalIncome`, `totalExpense`, `openingBalance`, `endingBalance`, percentages, hay `outstanding`.
4. **Quy tắc Hạch toán Mua Cầu vs Sử dụng Cầu**:
   - Khi **Mua cầu**: Ghi nhận Chi quỹ `expense_transactions` + Nhập kho `inventory_transactions` (+12 pieces/tube).
   - Khi **Sử dụng cầu trong buổi chơi**: Chỉ trừ tồn kho `inventory_transactions` (-delta pieces), **KHÔNG ghi nhận Chi quỹ lần 2**.
5. **Quy tắc Đóng tiền (No Overpaid Tracking)**:
   Không hỗ trợ theo dõi nộp dư (Overpaid). Số tiền nộp > số tiền còn thiếu $\rightarrow$ Báo lỗi HTTP 400 `PAYMENT_EXCEEDS_DEBT`.
6. **Thành viên Tham gia giữa Tháng (Mid-Month Joiner)**:
   Admin tự nhập số tiền nộp bổ sung $\rightarrow$ Ghi nhận vào `income_transactions` (Danh mục `OTHER_INCOME`). Không chạy phân bổ Quỹ cố định cho thành viên này trong tháng đó.
7. **Bảo tồn Lịch sử (Historical Data Immutability)**:
   Thay đổi cấu hình hiện tại (số ngày/tuần, đơn giá phí, trạng thái thành viên) **KHÔNG ĐƯỢC** làm thay đổi dữ liệu đã phát sinh trong quá khứ hoặc các kỳ tháng đã chốt (`CLOSED`).
8. **Quy tắc Làm tròn Tiền tệ (Financial Rounding Rules)**:
   - **Fixed Member Fee**: Làm tròn LÊN hàng **10,000 VND** (`ROUNDUP(amount, -4)`).
   - **Cash Ledger & Transactions**: Làm tròn LÊN hàng **1,000 VND** (`ROUNDUP(amount, -3)`).
   - **Visitor Fee**: Exact Admin input (Ví dụ: 55,555 VND giữ nguyên 55,555 VND, **KHÔNG làm tròn**).

---

## 2. QUY TẮC CÔNG THỨC VÀ TÍNH TOÁN

### 2.1. Công thức tính Số ngày chơi Dự kiến trong tháng

$$\text{Calculated Days} = \text{ROUNDUP}\left( \frac{\text{Days Per Week} \times \text{Days In Month}}{7}, 0 \right)$$

JavaScript:
```javascript
function calculateExpectedDays(daysPerWeek, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.ceil((daysPerWeek * daysInMonth) / 7);
}
```

#### Bảng Kiểm thử Chuẩn (Tháng 10/2026 = 31 ngày):
- 5 ngày/tuần: $\text{Math.ceil}(5 \times 31 / 7) = \mathbf{23\text{ ngày}}$
- 4 ngày/tuần: $\text{Math.ceil}(4 \times 31 / 7) = \mathbf{18\text{ ngày}}$
- 3 ngày/tuần: $\text{Math.ceil}(3 \times 31 / 7) = \mathbf{14\text{ ngày}}$
- 2 ngày/tuần: $\text{Math.ceil}(2 \times 31 / 7) = \mathbf{9\text{ ngày}}$
- 1 ngày/tuần: $\text{Math.ceil}(1 \times 31 / 7) = \mathbf{5\text{ ngày}}$

---

### 2.2. Quy tắc Làm tròn Quỹ cố định (10,000 VND Rounding)

$$\text{Fixed Fee Rounded} = \text{ROUNDUP}(\text{Original Amount}, -4)$$

JavaScript:
```javascript
function roundupToTenThousand(amount) {
  if (amount <= 0) return 0;
  return Math.ceil(amount / 10000) * 10000;
}
```

#### Test Cases Bắt buộc:
- `753,855` $\rightarrow$ `760,000`
- `458,868` $\rightarrow$ `460,000`
- `500,001` $\rightarrow$ `510,000`
- `500,000` $\rightarrow$ `500,000`

---

### 2.3. Quy tắc Phí Khách Vãng Lai (Visitor Fee Business Rules)

1. **Đơn giá mặc định**: 50,000 VND / buổi.
2. **Admin Override**: Admin được nhập số tiền tùy chỉnh (Ví dụ: 55,555 VND).
3. **KHÔNG làm tròn (NO Rounding)**: Giữ chính xác số tiền Admin nhập (55,555 VND giữ nguyên 55,555 VND).
4. **Phân biệt Phí Vãng lai Chưa thu & Đã thu**:
   - **Chưa thu (`UNPAID`)**: Tính vào `visitorFeeDue` và `visitorFeeOutstanding`. **KHÔNG** đưa vào Cash Ledger hay `income_transactions`.
   - **Đã thu (`PAID`)**: Tính vào `visitorFeeCollected`, giảm `outstanding`, sinh 1 bản ghi `income_transactions` (Danh mục `VISITOR_FEE`) và đưa vào Cash Ledger.
5. **Chống trùng**: Thanh toán lại Phí vãng lai với cùng `feeId` trả về giao dịch cũ, không sinh bản ghi thu trùng.

---

### 2.4. Quy tắc Sổ Quỹ Tiền Mặt (Cash Ledger & Carry Forward)

1. **Số dư đầu kỳ (`openingBalance`)**:
   $$\text{Opening Balance} = \sum \text{Income}_{< \text{monthKey}} - \sum \text{Expense}_{< \text{monthKey}}$$
   (Tính tích lũy từ tất cả các tháng trước có `is_void = 0`).
2. **Số dư cuối kỳ (`endingBalance`)**:
   $$\text{Ending Balance} = \text{Opening Balance} + \text{Total Income} - \text{Total Expense}$$
3. **Negative Balance Support**: Hệ thống chấp nhận số dư âm (Ví dụ: `-650,000 ₫`). Không clamp về 0, không làm mất dấu âm.
4. **VOID Transactions**: Bản ghi có `is_void = 1` hoàn toàn bị loại khỏi tính toán Sổ quỹ và Báo cáo.

---

### 2.5. Quy tắc Chốt Kỳ Tháng (Monthly Closing Protocol)

1. **Khóa dữ liệu kỳ `CLOSED`**:
   Mọi thao tác Thêm/Sửa/Xóa dữ liệu tài chính, buổi chơi, điểm danh, số cầu thuộc tháng đã `CLOSED` sẽ bị API chặn và trả về **HTTP 403 `MONTH_CLOSED`**.
2. **Admin Unlock**: Duy nhất Admin có quyền mở khóa kỳ, bắt buộc nhập lý do mở khóa và ghi vết `audit_logs`.
