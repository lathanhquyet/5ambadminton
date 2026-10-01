# BADMINTON FUND MANAGEMENT SYSTEM - SYSTEM ARCHITECTURE (V3.1 - CONFIRMED)

## 1. TỔNG QUAN KIẾN TRÚC (OVERVIEW)

Hệ thống **Quỹ Cầu Lông 5AM -- RISE & SHINE** được thiết kế theo mô hình **Client-Server kiến trúc tách biệt (Decoupled SPA + RESTful API Backend)** với công nghệ được ấn định chính thức:

- **Frontend**: React (v18+) + Vite + TypeScript + TailwindCSS.
- **Backend API**: Node.js + Express + TypeScript.
- **Database**: SQLite (WAL Mode, Single File Database).

### 1.1. Sơ đồ khối tổng thể (System Topology)

```
                                  +---------------------------------------+
                                  |            CLIENT / USERS             |
                                  +---------------------------------------+
                                       |                             |
                               (HTTPS / REST)                 (HTTPS / REST)
                                       |                             |
                                       v                             v
                         +--------------------------+   +--------------------------+
                         |       ADMIN PORTAL       |   |       PUBLIC SAOKE       |
                         | (React + Vite + Tailwind)|   | (React + Vite + Tailwind)|
                         +--------------------------+   +--------------------------+
                                       |                             |
                                       +--------------+--------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |      FRONTEND HOSTING     |
                                        |       (GitHub Pages)      |
                                        +---------------------------+
                                                      |
                                                 (API Calls)
                                                      |
                                                      v
                                        +---------------------------+
                                        |    BACKEND SERVER (VPS)   |
                                        | (Node.js+Express+TS API)  |
                                        +---------------------------+
                                                      |
                                       +--------------+--------------+
                                       |                             |
                                       v                             v
                        +----------------------------+  +--------------------------+
                        |      SQLITE DATABASE       |  |  FILE STORAGE / BACKUPS  |
                        | (Single File / SQLite WAL) |  |   (DB Backups / Exports) |
                        +----------------------------+  +--------------------------+
```

---

## 2. NGUYÊN TẮC THIẾT KẾ VÀ LUỒNG DỮ LIỆU ĐÃ ẤN ĐỊNH

### 2.1. Nguồn Chân lý Kho Cầu (Inventory Source of Truth)
- Bảng `inventory_transactions` là **SOURCE OF TRUTH** duy nhất cho mọi tính toán tồn kho (Nhập, Xuất, Sử dụng, Hoàn trả, Điều chỉnh).
- Bảng `inventory_monthly_balances` chỉ đóng vai trò là **SNAPSHOT / CACHE** phụ trợ nhằm tăng tốc độ truy vấn báo cáo, được tổng hợp hoàn toàn từ `inventory_transactions`.

### 2.2. Luồng Mua cầu vs Sử dụng cầu (Shuttle Accounting Flow)
- **Khi Mua Cầu (Shuttle Purchase)**:
  1. Ghi 1 giao dịch Chi quỹ vào `expense_transactions` (loại `SHUTTLE_PURCHASE`).
  2. Ghi 1 giao dịch Nhập kho vào `inventory_transactions` (loại `RECEIPT`, số lượng Quy đổi ra Trái).
- **Khi Sử dụng Cầu trong Buổi chơi (Shuttle Usage)**:
  1. Chỉ ghi 1 giao dịch Xuất kho vào `inventory_transactions` (loại `USAGE`).
  2. **Tuyệt đối KHÔNG ghi giao dịch Chi quỹ (`expense_transactions`) lần thứ hai.**

### 2.3. Quy tắc Đóng tiền (Payment Rule - No Overpaid Tracking)
- Hệ thống **không hỗ trợ theo dõi nộp dư (Overpaid)**. Thành viên yêu cầu đóng chính xác khoản công nợ cần phải đóng hoặc đóng từng phần (Partial).
- API Validation sẽ chặn các giao dịch đóng tiền lớn hơn số tiền công nợ còn thiếu.

### 2.4. Xử lý Thành viên Tham gia giữa Tháng (Mid-Month Joiner Flow)
- Khi thành viên gia nhập giữa tháng, Admin tự nhập số tiền đóng cho khoảng thời gian còn lại.
- Số tiền này được hệ thống ghi nhận vào `income_transactions` dưới danh mục **Thu khác (`OTHER_INCOME`)**, dùng làm khoản dự phòng bổ sung cho các khoản Chi khác trong tháng.
- Số dư tồn quỹ cuối tháng (Tổng Thu - Tổng Chi) sẽ tự động chuyển thành Tồn quỹ đầu kỳ cho tháng tiếp theo.

---

## 3. PHÂN TÍCH CÁC TẦNG KIẾN TRÚC (LAYER DETAILS)

### 3.1. Frontend Layer (React + Vite + TypeScript + TailwindCSS)
- Build công khai trên **GitHub Pages**.
- Route `/saoke`: Read-Only, không đăng nhập, gọi Public API.
- Route `/admin/*`: Quản trị viên, bảo mật bằng JWT Bearer Auth.

### 3.2. Backend Layer (Node.js + Express + TypeScript)
- Layered Architecture: Router $\rightarrow$ Controller $\rightarrow$ Service (Logic Engines) $\rightarrow$ Repository/Database Access (Knex / Kysely / Prisma).
- Business Services:
  - `FeeEngine`: Tính số ngày dự kiến $\text{Math.ceil}(d \times m / 7)$, tính quỹ cố định, áp dụng `ROUNDUP(amount, -3)`.
  - `InventoryEngine`: Xử lý kho lấy `inventory_transactions` làm Source of Truth.
  - `DebtEngine`: Tính công nợ exact (`Phải đóng - Đã đóng`), tạo VietQR payload.
  - `ClosingEngine`: Quản lý chốt kỳ, chặn mọi request thay đổi dữ liệu tháng đã `CLOSED`.

### 3.3. Database Layer (SQLite)
- Chạy `PRAGMA journal_mode = WAL;` và `PRAGMA foreign_keys = ON;`.
- Tối ưu sao lưu: Copy trực tiếp file `.db` hoặc dùng lệnh Backup API.
