# BADMINTON FUND MANAGEMENT SYSTEM - PHASED IMPLEMENTATION PLAN (V3.1 - CONFIRMED)

Tài liệu này xác định lộ trình triển khai dự án theo từng Phase đã chốt công nghệ và quy tắc nghiệp vụ chính thức.

---

## 1. NGUYÊN TẮC VÀ CÔNG NGHỆ THỰC HIỆN

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Database**: SQLite (WAL Mode)
- **Tuần tự & Chặt chẽ**: Hoàn thành 100% mục tiêu và vượt qua tất cả test criteria của Phase hiện tại trước khi chuyển sang Phase tiếp theo.
- **Không Mock Data trong Production**: Mọi module kết nối SQLite DB thật.

---

## 2. LỘ TRÌNH CHI TIẾT THEO CÁC PHASE

### PHASE 1: FOUNDATION, DATABASE & MEMBER MANAGEMENT
- **Mục tiêu**: Thiết lập cấu trúc dự án, khởi tạo DB SQLite, quản lý tài khoản & thành viên.
- **Công việc chi tiết**:
  1. Setup Repository với hai thư mục chính: `frontend/` (Vite React TS Tailwind) và `backend/` (Express TS), `docker-compose.yml`, `.env.example`.
  2. Cấu hình SQLite Engine, PRAGMA WAL mode & Migration System (Knex / Kysely / Prisma).
  3. Xây dựng Module Authentication & RBAC (JWT Token, Password Hashing Argon2/Bcrypt, Roles `ADMIN` & `MEMBER`).
  4. Xây dựng Data Models & Endpoints cho `members`:
     - Phân loại `FIXED` vs `VISITOR`.
     - Nhập `days_per_week` (0..7 ngày/tuần) cho thành viên cố định.
     - Hàm tự động tính số ngày dự kiến: `Math.ceil(daysPerWeek * daysInMonth / 7)`.
- **Nghiệm thu Phase 1**:
  - [ ] Migration tạo 20 bảng chuẩn trên DB SQLite.
  - [ ] Login Admin thu được JWT Token.
  - [ ] CRUD Member hoạt động. Test tính đúng `5 ngày/tuần tháng 10/2026 = 23 ngày`.

---

### PHASE 2: PLAYING SESSIONS, ATTENDANCE & SHUTTLE INVENTORY
- **Mục tiêu**: Theo dõi lịch chơi, điểm danh giao diện bảng linh hoạt, quản lý số cầu sử dụng và trừ kho (Source of Truth: `inventory_transactions`).
- **Công việc chi tiết**:
  1. Module `playing_sessions`: Tạo buổi chơi theo ngày, hiển thị dạng Lưới/Bảng tháng.
  2. Giao diện Điểm danh nhanh (Checkbox toggle): API `POST /sessions/:id/attendance` toggle `PRESENT`/`ABSENT`, tự động đếm `total_players`.
  3. Module Số cầu sử dụng (`shuttle_used`): Admin nhập số cầu thực tế cả buổi.
  4. Tích hợp Inventory Engine:
     - Bảng `inventory_transactions` là **SOURCE OF TRUTH**.
     - Sửa số cầu dùng: Tính Delta $(N_{mới} - N_{cũ})$ và trừ kho đúng delta trong `inventory_transactions`.
     - **Tài chính**: KHÔNG ghi nhận giao dịch Chi quỹ khi xuất cầu sử dụng.
     - Hủy buổi chơi: Hoàn lại số cầu vào kho (`REFUND`).
- **Nghiệm thu Phase 2**:
  - [ ] Điểm danh 10 member, check 7 -> tự đếm 7 người.
  - [ ] Sửa số cầu từ 3 -> 4 -> Kho chỉ giảm thêm 1 trái trong `inventory_transactions`.
  - [ ] Hủy session 5 cầu -> Kho hoàn lại đủ 5 trái.

---

### PHASE 3: FEE ENGINE, PAYMENT, DEBT & QR (NO OVERPAID)
- **Mục tiêu**: Động cơ tính phí, Công nợ, Đóng tiền nhiều lần (chặn Overpaid) và VietQR.
- **Công việc chi tiết**:
  1. Xây dựng `FeeEngine`:
     - Fee Versioning (`effective_from`, `effective_to`).
     - 3 Phương pháp phân bổ Quỹ cố định (A - Chia đều, B - Theo ngày đăng ký, C - Thủ công).
     - Phí vãng lai (tính theo số lượt chơi thực tế $\times$ đơn giá vãng lai).
     - Quy tắc làm tròn hàng nghìn `ROUNDUP(amount, -3)`.
  2. Xây dựng `DebtEngine`:
     - Lập bảng Công nợ theo tháng (`Phải đóng`, `Đã đóng`, `Còn thiếu`, `Trạng thái`).
  3. Xây dựng Module Payment:
     - Cho phép nộp tiền một phần / nhiều lần. Chặn thanh toán vượt công nợ còn thiếu (chặn Overpaid).
  4. Tích hợp VietQR Service:
     - Sinh QR VietQR chứa chính xác Số tiền còn thiếu + Cú pháp chuyển khoản.
- **Nghiệm thu Phase 3**:
  - [ ] Test làm tròn: `774,100 -> 775,000`.
  - [ ] Test thanh toán nhiều lần: `200,000 + 300,000 = 500,000` -> Status `PAID`.
  - [ ] Test nộp 300,000đ cho nợ 200,000đ -> Server báo lỗi `PAYMENT_EXCEEDS_DEBT`.

---

### PHASE 4: CASH LEDGER & MID-MONTH JOINER HANDLING
- **Mục tiêu**: Quản lý Chi quỹ (Sân, Mua cầu, Chi khác) và Thu khác (Thành viên gia nhập giữa tháng).
- **Công việc chi tiết**:
  1. Module Phí sân (`court_fee_configs`): Giá sân/ngày $\times$ Số ngày $\times$ Số sân $\rightarrow$ `expense_transaction`.
  2. Module Mua cầu (`shuttle_purchases`):
     - Nhập đợt mua cầu $\rightarrow$ Sinh `expense_transaction` (Chi tiền) + Sinh `inventory_transaction` (Nhập kho).
  3. Module Thành viên Gia nhập Giữa tháng:
     - Admin nhập thủ công số tiền đóng cho nửa tháng còn lại.
     - Sinh `income_transaction` loại **Thu khác (`OTHER_INCOME`)**, phục vụ làm ngân sách dự phòng cho Chi khác.
  4. Sổ quỹ Cash Ledger: Tồn Quỹ = $\sum \text{Thu} - \sum \text{Chi}$. Tồn quỹ cuối tháng tự chuyển thành Tồn đầu kỳ tháng sau.
- **Nghiệm thu Phase 4**:
  - [ ] Mua cầu 10 ống giá 650,000đ -> Tự tăng 120 trái trong kho + ghi nhận Chi 6,500,000đ.
  - [ ] Nhập thu thành viên giữa tháng vào Thu khác -> Tồn quỹ cập nhật chính xác.

---

### PHASE 5: DASHBOARDS, PUBLIC SAOKE & REPORTS
- **Mục tiêu**: Dashboard Admin, Trang Sao kê công khai `/saoke` (Read-only, Mobile responsive).
- **Công việc chi tiết**:
  1. Admin Dashboard KPI:
     - 3 thẻ Thu - Chi - Tồn (Đỏ nếu âm, Xanh nếu dương).
     - Filter Tháng/Năm. Drill-down xem chi tiết.
  2. Public Saoke Page (`/saoke`):
     - Route công khai không cần login (React + TailwindCSS).
     - Báo cáo Thu - Chi - Tồn theo tháng, Chi tiết Thu (% tỷ trọng), Chi tiết Chi (% tỷ trọng).
     - Nút Sao chép Link & Mã QR chia sẻ trang Sao kê.
- **Nghiệm thu Phase 5**:
  - [ ] Mở `/saoke` trên điện thoại hiển thị đẹp, responsive, read-only.
  - [ ] Không lộ dữ liệu nhạy cảm (SĐT, Email, Audit).

---

### PHASE 6: MONTHLY CLOSING, AUDIT, BACKUP & DOCKER PACKAGING
- **Mục tiêu**: Chốt kỳ tháng, Audit Log, Backup/Restore, Export và Dockerizing.
- **Công việc chi tiết**:
  1. Module Monthly Closing (`monthly_closings`):
     - Khóa dữ liệu kỳ `CLOSED` (API trả HTTP 403 nếu sửa).
     - Chuyển Tồn kho và Tồn quỹ tháng N sang tháng N+1.
     - Admin Unlock có lý do + Audit Log.
  2. Module Audit Log: Ghi vết toàn bộ thao tác void, sửa tiền, chốt/mở kỳ.
  3. Backup & Restore: Import/Export file SQLite `.db`.
  4. Export: Excel, CSV, PDF.
  5. Docker Packaging (`Dockerfile`, `docker-compose.yml`, `README.md`).
- **Nghiệm thu Phase 6**:
  - [ ] Sửa dữ liệu kỳ đã CLOSED -> Bị API chặn (403 Forbidden).
  - [ ] Admin unlock kỳ -> Audit Log ghi đúng thông tin.
  - [ ] `docker-compose up` thành công toàn bộ hệ thống.
