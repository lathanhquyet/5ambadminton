# BADMINTON FUND MANAGEMENT SYSTEM - DESIGN CONFIRMATIONS (ALL RESOLVED)

Tất cả các vấn đề thiết kế và quyết định công nghệ đã được **XÁC NHẬN CHÍNH THỨC** bởi User. Không còn điểm nào chưa rõ.

---

## BẢNG TỔNG HỢP QUYẾT ĐỊNH THIẾT KẾ DỰ ÁN

| STT | Hạng mục thiết kế | Quy định đã chốt chính thức |
|---|---|---|
| **1** | **Backend Framework** | **Node.js + Express + TypeScript** |
| **2** | **Frontend Framework** | **React + Vite + TypeScript + TailwindCSS** |
| **3** | **Database Engine** | **SQLite (Single file, WAL mode)** |
| **4** | **Payment OVERPAID** | **Không hỗ trợ theo dõi nộp dư**. Thành viên bắt buộc đóng đúng hoặc đóng từng phần công nợ cần phải đóng. API chặn giao dịch đóng lớn hơn công nợ còn thiếu. |
| **5** | **Thành viên Gia nhập Giữa tháng** | Admin tự nhập số tiền đóng cho khoảng thời gian còn lại. Số tiền này ghi nhận vào **Thu khác (`OTHER_INCOME`)**, làm ngân sách dự phòng bổ sung cho khoản Chi khác trong tháng. Tồn quỹ cuối tháng tự chuyển thành Tồn đầu kỳ cho tháng mới. |
| **6** | **Hạch toán Cầu Lông** | Mua cầu: Ghi nhận **Chi quỹ (`expense_transactions`) + Nhập kho (`inventory_transactions`)**. Khi Sử dụng cầu trong buổi chơi: **Chỉ trừ Kho (`inventory_transactions`), KHÔNG ghi Chi quỹ lần 2**. |
| **7** | **Kho Cầu Source of Truth** | **`inventory_transactions` là SOURCE OF TRUTH duy nhất**. Bảng `inventory_monthly_balances` chỉ là snapshot/cache phụ trợ. |
| **8** | **Công thức ROUNDUP** | Giữ nguyên: <br>• Ngày dự kiến: $\text{Math.ceil}(\text{daysPerWeek} \times \text{daysInMonth} / 7)$<br>• Tiền tệ: Làm tròn LÊN hàng nghìn `ROUNDUP(amount, -3)`. |
| **9** | **Chốt kỳ, Audit & Sao kê** | Giữ nguyên Monthly Closing (khóa kỳ), Audit Log chi tiết và Trang Sao kê Công khai `/saoke` (Read-only, Public). |

---

> **HỆ THỐNG ĐÃ SẴN SÀNG 100% CHO PHASE 1 (PROJECT SETUP, DATABASE & MEMBER MANAGEMENT).**
