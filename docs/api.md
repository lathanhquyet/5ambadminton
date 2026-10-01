# BADMINTON FUND MANAGEMENT SYSTEM - API SPECIFICATION (V3.1 - CONFIRMED)

## 1. QUY CHUẨN CHUNG (GENERAL CONVENTIONS)

- **Tech Stack**: Backend Node.js + Express + TypeScript, Frontend React + Vite + TypeScript + TailwindCSS, Database SQLite.
- **Base URL**: `/api/v1`
- **Data Format**: JSON (`Content-Type: application/json`)
- **Authentication**: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`) đối với Admin Endpoints.
- **Phân quyền Route**:
  - `GET /api/v1/public/*`: Không yêu cầu Token. Read-only.
  - `/api/v1/admin/*` hoặc các API ghi dữ liệu: Đòi hỏi Role Admin.

### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Thành công",
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "CLOSED_PERIOD_LOCKED",
    "message": "Không thể thay đổi dữ liệu của tháng 09/2026 đã CHỐT.",
    "details": []
  }
}
```

---

## 2. PUBLIC ENDPOINTS (TRANG SAO KÊ /saoke)

Các API này phục vụ cho thành viên xem báo cáo công khai mà **không cần đăng nhập (NO JWT / Auth Header Required)**. Read-Only, 0 mutation.

### 2.1. Lấy Báo cáo Sao kê Công khai Hàng tháng (Phase 5C Task 1 - CONFIRMED & PASS)
`GET /api/v1/public/saoke/monthly?month=YYYY-MM`

- **Authentication**: Không yêu cầu (Public Access).
- **Validation**: Bắt buộc có query parameter `month` đúng định dạng `YYYY-MM`.
- **Security**: Allow-list DTO, tuyệt đối không leak sensitive keys (password, tokens, JWT, email, phone, mobile, address).
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "month": "2026-09",
    "financial": {
      "month": "2026-09",
      "openingBalance": 0,
      "totalIncome": 12500000,
      "totalExpense": 8200000,
      "endingBalance": 4300000
    },
    "incomeBreakdown": {
      "FIXED_FUND": { "amount": 10000000, "percentage": 80.00 },
      "VISITOR_FEE": { "amount": 1500000, "percentage": 12.00 },
      "OTHER_INCOME": { "amount": 1000000, "percentage": 8.00 }
    },
    "expenseBreakdown": {
      "COURT_FEE": { "amount": 5000000, "percentage": 60.98 },
      "SHUTTLE_PURCHASE": { "amount": 2000000, "percentage": 24.39 },
      "OTHER_EXPENSE": { "amount": 1200000, "percentage": 14.63 }
    },
    "visitorFee": {
      "due": 2000000,
      "collected": 1500000,
      "outstanding": 500000,
      "cashIncome": 1500000
    },
    "activity": {
      "sessions": 20,
      "totalPlayers": 156,
      "shuttleUsed": 32,
      "currentInventory": 88
    }
  }
}
```

- **Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12)."
  }
}
```

### 2.2. Lấy Danh sách Khoản Quỹ Chưa Đóng Công khai (Phase 5B/5C Remediation - CONFIRMED & PASS)
`GET /api/v1/public/saoke/debtors?month=YYYY-MM`

- **Authentication**: Không yêu cầu (Public Access).
- **Validation**: Bắt buộc có query parameter `month` đúng định dạng `YYYY-MM`.
- **Filtering**: Chỉ trả về các thành viên/khách vãng lai có `remainingAmount > 0`. Những người đã đóng đủ (`remainingAmount == 0`) hoặc khách miễn phí (`0 đ`) tự động bị loại bỏ.
- **Security**: Allow-list DTO (`PublicDebtorDTO`), tuyệt đối không leak sensitive keys (password, tokens, JWT, email, phone, mobile, address).
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "memberId": "mem_fixed_01",
      "memberName": "A Nguyên",
      "memberType": "FIXED",
      "daysPerWeek": 3,
      "month": "2026-10",
      "totalFeeRequired": 460000,
      "paidAmount": 0,
      "remainingAmount": 460000,
      "status": "UNPAID",
      "paymentReference": "5AM-ANGUYEN-T10-2026"
    },
    {
      "memberId": "mem_v_123456",
      "memberName": "Anh Thông 3",
      "memberType": "VISITOR",
      "daysPerWeek": 0,
      "month": "2026-10",
      "totalFeeRequired": 60000,
      "paidAmount": 0,
      "remainingAmount": 60000,
      "status": "UNPAID",
      "paymentReference": "5AM-ANHTHONG3-T10-2026"
    }
  ]
}
```

---

## 3. AUTHENTICATION ENDPOINTS

### 3.1. Đăng nhập Admin / Member
`POST /api/v1/auth/login`

---

## 4. MEMBER MANAGEMENT ENDPOINTS (ADMIN)

### 4.1. Lấy danh sách thành viên
`GET /api/v1/members?type=FIXED&status=ACTIVE`

### 4.2. Thêm mới thành viên
`POST /api/v1/members`

### 4.3. Cập nhật thông tin thành viên
`PUT /api/v1/members/:id`

---

## 5. PLAYING SESSION & ATTENDANCE ENDPOINTS

### 5.1. Lấy danh sách buổi chơi theo tháng
`GET /api/v1/sessions?month=2026-10`

### 5.2. Điểm danh thành viên trong buổi chơi (Fast Click Checkbox)
`POST /api/v1/sessions/:id/attendance`

### 5.3. Cập nhật số cầu thực tế sử dụng trong buổi
`PUT /api/v1/sessions/:id/shuttle-usage`

**Request Body:**
```json
{
  "shuttle_used": 4
}
```
**Xử lý phía Server**:
1. Tính delta = 4 - (số cầu hiện tại của session).
2. Tự động gọi `InventoryEngine.recordUsage(session_id, delta)` trên `inventory_transactions` (Source of Truth).
3. **KHÔNG sinh giao dịch Chi quỹ (`expense_transactions`).**

### 5.4. Hủy buổi chơi
`POST /api/v1/sessions/:id/cancel`

---

## 6. INVENTORY MANAGEMENT ENDPOINTS

### 6.1. Báo cáo Nhập - Xuất - Tồn theo tháng (Tổng hợp từ Source of Truth)
`GET /api/v1/inventory/summary?month=2026-09`

### 6.2. Mua cầu (Tạo Chi quỹ + Nhập kho)
`POST /api/v1/inventory/receipts`

**Request Body:**
```json
{
  "product_id": "prod_tc77",
  "transaction_date": "2026-09-05",
  "tubes_qty": 10,
  "price_per_tube": 650000,
  "supplier": "Cửa hàng thể thao X",
  "notes": "Mua cầu đợt 1 tháng 9"
}
```
**Xử lý phía Server**:
1. Thêm `expense_transactions` (Category: `SHUTTLE_PURCHASE`, Amount: `6500000`).
2. Thêm `inventory_transactions` (Type: `RECEIPT`, Quantity: `120` trái).

---

## 7. FEE ENGINE, DEBT & INCOME ENDPOINTS

### 7.1. Chạy động cơ tính phí tháng
`POST /api/v1/fees/calculate-monthly`

### 7.2. Nhập thu tiền cho Thành viên tham gia giữa tháng
`POST /api/v1/transactions/income`

**Request Body:**
```json
{
  "transaction_date": "2026-09-15",
  "month_key": "2026-09",
  "category": "OTHER_INCOME",
  "description": "Thành viên A tham gia nửa sau tháng 9",
  "member_id": "mem_005",
  "amount": 400000,
  "payment_method": "BANK_TRANSFER",
  "notes": "Admin tự nhập khoản thu bổ sung cho thành viên tham gia giữa tháng"
}
```

### 7.3. Lấy bảng công nợ thành viên
`GET /api/v1/debts?month=2026-09`

### 7.4. Ghi nhận đóng tiền (Payment Recording - Chặn Overpaid)
`POST /api/v1/payments`

**Request Body:**
```json
{
  "member_id": "mem_002",
  "payment_date": "2026-09-15",
  "month_key": "2026-09",
  "amount": 200000,
  "payment_method": "BANK_TRANSFER",
  "bank_tx_code": "FT26258900123",
  "notes": "Chuyển khoản đợt 1"
}
```
**Ràng buộc Validation**:
- Nếu `amount > remaining_amount` $\rightarrow$ Server trả về lỗi `HTTP 400 Bad Request`:
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_EXCEEDS_DEBT",
    "message": "Số tiền đóng (300,000đ) lớn hơn công nợ còn thiếu (200,000đ). Hệ thống không hỗ trợ theo dõi nộp dư."
  }
}
```

### 7.5. Sinh dữ liệu QR VietQR cho công nợ
`GET /api/v1/payments/:member_id/qr?month=2026-09`

---

## 8. MONTHLY CLOSING & AUDIT ENDPOINTS

### 8.1. Thực hiện Chốt Kỳ Tháng (Lock Month)
`POST /api/v1/closing/lock`

### 8.2. Mở khóa Kỳ Tháng (Unlock Month) - Chỉ Admin
`POST /api/v1/closing/unlock`

### 8.3. Xem nhật ký Audit Log
`GET /api/v1/audit-logs?module=CLOSING`

---

## 9. REPORT LAYER ENDPOINTS (PHASE 5A)

### 9.1. Lấy báo cáo tổng quan tài chính & hoạt động tháng (Read-Only Single Source of Truth)
`GET /api/v1/reports/monthly?month=YYYY-MM`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)
**Query Parameters**:
- `month` (string, required): Định dạng `YYYY-MM` (từ `01` đến `12`).

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "month": "2026-09",
    "financial": {
      "openingBalance": 3000000,
      "totalIncome": 12500000,
      "totalExpense": 8200000,
      "endingBalance": 7300000
    },
    "incomeBreakdown": {
      "FIXED_FUND": {
        "amount": 10000000,
        "percentage": 80.00
      },
      "VISITOR_FEE": {
        "amount": 1500000,
        "percentage": 12.00
      },
      "OTHER_INCOME": {
        "amount": 1000000,
        "percentage": 8.00
      }
    },
    "expenseBreakdown": {
      "COURT_FEE": {
        "amount": 5000000,
        "percentage": 60.98
      },
      "SHUTTLE_PURCHASE": {
        "amount": 2000000,
        "percentage": 24.39
      },
      "OTHER_EXPENSE": {
        "amount": 1200000,
        "percentage": 14.63
      }
    },
    "visitorFee": {
      "due": 2000000,
      "collected": 1500000,
      "outstanding": 500000,
      "cashIncome": 1500000
    },
    "activity": {
      "sessions": 20,
      "totalPlayers": 156,
      "shuttleUsed": 32,
      "currentInventory": 88
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Định dạng tháng không hợp lệ. Vui lòng sử dụng YYYY-MM (từ 01 đến 12)."
  }
}
```

---

## 10. PUBLIC SAOKE & VIETQR PAYMENT ENDPOINTS (PHASE 5C)

### 10.1. Lấy báo cáo tài chính sao kê công khai
`GET /api/v1/public/saoke/monthly?month=YYYY-MM`

**Authentication**: Unauthenticated (Không cần JWT / Login)  
**Security**: Allow-list DTO, tự động ẩn thông tin cá nhân (SĐT, Email, Password, Tokens).

---

### 10.2. Lấy cấu hình tài khoản nhận tiền Admin
`GET /api/v1/admin/payment-settings`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "bankName": "MB",
    "bankBin": "970436",
    "accountNumber": "090123456789",
    "accountName": "QUY CAU LONG 5AM"
  }
}
```

---

### 10.3. Cập nhật cấu hình tài khoản nhận tiền Admin
`PUT /api/v1/admin/payment-settings`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Request Body:**
```json
{
  "enabled": true,
  "bankName": "Vietcombank",
  "bankBin": "970436",
  "accountNumber": "0123456789",
  "accountName": "QUY CAU LONG 5AM OFFICIAL"
}
```

---

### 10.4. Lấy thông tin tài khoản nhận tiền công khai
`GET /api/v1/public/payment-info`

**Authentication**: Unauthenticated (Không cần JWT)  
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "bankName": "MB",
    "bankBin": "970436",
    "accountNumber": "090123456789",
    "accountName": "QUY CAU LONG 5AM"
  }
}
```

---

### 10.5. Tạo mã VietQR thanh toán động công khai
`GET /api/v1/public/payment/qr?month=YYYY-MM&memberId=...`

**Authentication**: Unauthenticated (Không cần JWT)  
**Query Parameters**:
- `month` (string, required): `YYYY-MM`
- `memberId` (string, required): ID thành viên (ví dụ `mem_01`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "month": "2026-09",
    "memberId": "mem_01",
    "memberName": "Nguyễn Văn A",
    "memberCode": "NGUYENVANA",
    "amount": 350000,
    "currency": "VND",
    "bankName": "MB",
    "bankBin": "970436",
    "accountNumber": "090123456789",
    "accountName": "QUY CAU LONG 5AM",
    "transferContent": "5AM-NGUYENVANA-T09-2026",
    "qr": {
      "format": "image",
      "url": "https://img.vietqr.io/image/MB-090123456789-compact.png?amount=350000&addInfo=5AM-NGUYENVANA-T09-2026"
    }
  }
}
```
**Quy tắc bất biến (Financial Integrity Rule)**:
- Việc tạo, hiển thị hoặc tải mã QR tuyệt đối **KHÔNG** làm thay đổi trạng thái nợ (`UNPAID`), **KHÔNG** tự động tạo giao dịch thanh toán hay thu nhập (`NO DATABASE FINANCIAL MUTATION`).

---

### 10.6. Gửi thông báo chuyển khoản Telegram công khai
`POST /api/v1/public/payment/notify`

**Authentication**: Unauthenticated (Không cần JWT / Login)  
**Request Body:**
```json
{
  "paymentReference": "5AM-ANHTHONG3-T10-2026"
}
```
*Ghi chú*: Frontend chỉ truyền duy nhất `paymentReference`. Tên và số tiền được server tự động resolve từ database (`Server-side resolution ONLY`). Server-side rate limiter / cooldown 5s chống gửi trùng lặp. **ZERO DATABASE FINANCIAL MUTATION**.

---

### 10.7. Lấy cấu hình Telegram Bot Admin
`GET /api/v1/admin/telegram-settings`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "hasBotToken": true,
    "botTokenMasked": "1234...wxyz",
    "chatId": "-100987654321"
  }
}
```
*Lưu ý bảo mật*: Bot API Token gốc tuyệt đối KHÔNG bao giờ bị expose ra bên ngoài.

---

### 10.8. Cập nhật cấu hình Telegram Bot Admin
`PUT /api/v1/admin/telegram-settings`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Request Body:**
```json
{
  "enabled": true,
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chatId": "-100987654321"
}
```

---

### 10.9. Kiểm tra kết nối Telegram Bot Admin
`POST /api/v1/admin/telegram-settings/test`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Đã gửi tin nhắn kiểm tra tới Telegram thành công."
  }
}
```

---

## 11. FINANCIAL OPERATIONS ENDPOINTS (PHASE 5B GUI REMEDIATION)

### 11.1. Tạo Phiếu Thu Phí Vãng Lai Thủ Công
`POST /api/v1/transactions/visitor-fee`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Request Body:**
```json
{
  "transaction_date": "2026-09-30",
  "month_key": "2026-09",
  "payer_name": "Khách vãng lai A",
  "amount": 37500,
  "payment_method": "CASH"
}
```
*Ghi chú*: `amount` > 0, giữ nguyên con số chính xác nhập vào, KHÔNG làm tròn (`amount = rounded_amount`).

### 11.2. Tạo Phiếu Thu Khác Thủ Công
`POST /api/v1/transactions/other-income`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Request Body:**
```json
{
  "transaction_date": "2026-09-30",
  "month_key": "2026-09",
  "description": "Bán đồ cũ",
  "source": "Anh Nam",
  "amount": 123456,
  "payment_method": "BANK_TRANSFER"
}
```
*Ghi chú*: `amount` > 0, giữ nguyên con số chính xác nhập vào, KHÔNG làm tròn (`amount = rounded_amount`).

### 11.3. Lấy Lịch Sử Giao Dịch Hợp Nhất (Unified Transaction History)
`GET /api/v1/transactions/history?month=YYYY-MM&type=ALL|INCOME|EXPENSE&category=...&search=...&page=1&limit=50`

**Authentication**: Required (`Authorization: Bearer <jwt_token>`, Role: `ADMIN`)  
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "inc_vis_12345678",
        "date": "2026-09-30",
        "type": "INCOME",
        "category": "VISITOR_FEE",
        "categoryLabel": "Phí vãng lai",
        "description": "Thu phí vãng lai - Khách vãng lai A",
        "payerOrRecipient": "Khách vãng lai A",
        "amount": 37500,
        "paymentMethod": "CASH",
        "reference": "INC-VIS-12345678",
        "createdBy": "ADMIN"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "totalPages": 1
    }
  }
}
```


