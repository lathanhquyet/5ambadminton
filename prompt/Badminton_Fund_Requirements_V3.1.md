# BADMINTON FUND MANAGEMENT SYSTEM

## QUỸ 5AM -- RISE & SHINE

### Product Requirements & Technical Specification -- V3.1

> **Tài liệu yêu cầu chính thức để Antigravity đọc và xây dựng phần
> mềm.**
>
> Tài liệu này hợp nhất toàn bộ yêu cầu từ V1, V2, V3 và V3.1. Khi có
> nội dung trùng nhau, ưu tiên quy tắc ở phần cập nhật mới nhất.

------------------------------------------------------------------------

# 1. MỤC TIÊU

Xây dựng một ứng dụng web quản lý Quỹ Cầu Lông cho nhóm chơi cầu lông
định kỳ.

Hệ thống phải quản lý:

-   Thành viên cố định.
-   Thành viên vãng lai.
-   Lịch chơi.
-   Theo dõi thành viên tham gia từng buổi.
-   Số cầu thực tế sử dụng từng buổi.
-   Quỹ cố định.
-   Phí vãng lai.
-   Các khoản thu khác.
-   Phí sân.
-   Chi phí mua cầu.
-   Các khoản chi khác.
-   Kho cầu theo ống/trái.
-   Nhập -- xuất -- tồn.
-   Chuyển tồn sang tháng tiếp theo.
-   Công nợ thành viên.
-   Thanh toán một phần/nhiều lần.
-   QR thanh toán.
-   Dashboard Thu -- Chi -- Tồn.
-   Trang Sao kê công khai cho thành viên.
-   Báo cáo sử dụng cầu theo tháng.
-   Chốt kỳ.
-   Audit Log.
-   Backup/Restore.
-   Export báo cáo.

Nguyên tắc quan trọng nhất:

> **Thay đổi cấu hình hiện tại không được làm thay đổi dữ liệu lịch sử
> đã phát sinh hoặc đã thanh toán/chốt kỳ.**

------------------------------------------------------------------------

# 2. KIẾN TRÚC TỔNG THỂ

Kiến trúc đề xuất:

``` text
                    INTERNET
                       |
          +------------+-------------+
          |                          |
          v                          v
   GitHub Pages                 Backend API
   Frontend                    REST API
          |                          |
          +------------+-------------+
                       |
                       v
                    SQLite
```

## 2.1. Database

Ưu tiên:

1.  SQLite.
2.  MongoDB nếu có lý do kỹ thuật rõ ràng.
3.  PostgreSQL nếu kiến trúc triển khai yêu cầu.

Ưu tiên SQLite vì:

-   Open source.
-   Nhẹ.
-   Dễ backup.
-   Dễ restore.
-   Không cần DB server riêng.
-   Phù hợp quy mô nhóm cầu lông.
-   Dễ chạy Docker/VPS.

## 2.2. GitHub Pages

GitHub Pages chỉ dùng cho frontend/static website.

**Không được hiểu rằng SQLite chạy trực tiếp trên GitHub Pages.**

Production:

``` text
GitHub Pages
    +
Backend API
    +
SQLite
```

Local:

``` text
Docker Compose
    |
    +-- Frontend
    +-- Backend
    +-- SQLite
```

Không dùng LocalStorage/IndexedDB làm database chính.

LocalStorage/IndexedDB chỉ được dùng cho cache hoặc UI preference nếu
cần.

## 2.3. Environment

Không hard-code API URL.

Dùng biến môi trường, ví dụ:

``` text
VITE_API_URL
```

Cần có:

``` text
.env.example
docker-compose.yml
README.md
```

------------------------------------------------------------------------

# 3. CÔNG NGHỆ

Ưu tiên:

-   Frontend: React + Vite hoặc stack tương đương.
-   Backend: FastAPI hoặc Node.js/Express/NestJS.
-   Database: SQLite.
-   REST API.
-   Docker.
-   Authentication.
-   RBAC.
-   Database migration.
-   Seed data.

Antigravity có thể chọn stack tương đương nếu chứng minh được lý do kỹ
thuật.

Yêu cầu:

-   Maintainable.
-   Scalable.
-   Easy backup.
-   Easy restore.
-   Easy deployment.

------------------------------------------------------------------------

# 4. PHÂN QUYỀN

## ADMIN

Toàn quyền:

-   Thành viên.
-   Lịch chơi.
-   Thu.
-   Chi.
-   Kho cầu.
-   Cấu hình phí.
-   Công nợ.
-   QR.
-   Dashboard.
-   Chốt tháng.
-   Mở khóa tháng.
-   Bank account.
-   Audit Log.
-   Backup/Restore.

## MEMBER

Nếu triển khai tài khoản thành viên:

-   Xem thông tin cá nhân.
-   Xem công nợ.
-   Xem lịch sử đóng tiền.
-   Xem QR.

Không được sửa dữ liệu tài chính.

## PUBLIC

Trang `/saoke`:

-   Không yêu cầu đăng nhập.
-   Read-only.
-   Chỉ xem dữ liệu báo cáo được Admin cho phép.
-   Không expose thông tin nhạy cảm.

------------------------------------------------------------------------

# 5. QUẢN LÝ THÀNH VIÊN

## 5.1. Thành viên cố định

Thông tin:

-   ID.
-   Họ tên.
-   Số điện thoại.
-   Email.
-   Ngày tham gia.
-   Trạng thái:
    -   Active
    -   Suspended
    -   Inactive
-   Số ngày đăng ký chơi/tuần.
-   Ghi chú.

Admin nhập:

``` text
Số ngày đăng ký chơi / tuần
```

Không nhập trực tiếp số ngày/tháng.

Cho phép:

``` text
0 -> 7 ngày/tuần
```

## 5.2. Thành viên vãng lai

Thông tin:

-   ID.
-   Họ tên.
-   Số điện thoại.
-   Ngày tham gia.
-   Ngày chơi.
-   Số lần chơi.
-   Phí vãng lai.
-   Trạng thái thanh toán.

------------------------------------------------------------------------

# 6. CÔNG THỨC TÍNH SỐ NGÀY CHƠI DỰ KIẾN

Số ngày chơi dự kiến trong tháng được tính từ:

``` text
Số ngày đăng ký/tuần
x
Số ngày trong tháng
/
7
```

Sau đó ROUNDUP lên số nguyên.

Công thức:

``` text
ROUNDUP(
    Số ngày/tuần * Số ngày trong tháng / 7,
    0
)
```

Excel/Google Sheets:

``` excel
=ROUNDUP(
  Số_ngày_trên_tuần *
  DAY(EOMONTH(DATE(Năm;Tháng;1);0))
  / 7;
  0
)
```

JavaScript:

``` javascript
Math.ceil(daysPerWeek * daysInMonth / 7)
```

## Ví dụ tháng 10/2026

31 ngày.

Thành viên đăng ký 5 ngày/tuần:

``` text
ROUNDUP(5 * 31 / 7, 0)
= ROUNDUP(22.142857, 0)
= 23
```

Kết quả: **23 ngày**.

Các ví dụ:

``` text
5 ngày/tuần -> 23 ngày
4 ngày/tuần -> 18 ngày
3 ngày/tuần -> 14 ngày
2 ngày/tuần -> 9 ngày
1 ngày/tuần -> 5 ngày
```

## Năm nhuận

Phải tính đúng:

``` text
02/2028 = 29 ngày
02/2027 = 28 ngày
```

Ví dụ:

``` text
02/2028, 5 ngày/tuần
ROUNDUP(5 * 29 / 7, 0)
= 21
```

``` text
02/2027, 5 ngày/tuần
ROUNDUP(5 * 28 / 7, 0)
= 20
```

------------------------------------------------------------------------

# 7. NGÀY DỰ KIẾN VÀ NGÀY THỰC TẾ

Phải phân biệt hoàn toàn:

## Ngày chơi dự kiến

Dùng để tính Quỹ cố định.

Ví dụ:

``` text
5 ngày/tuần
Tháng 10
=> 23 ngày dự kiến
```

## Ngày chơi thực tế

Lấy từ module Playing Session và Attendance.

Ví dụ:

``` text
Đăng ký: 23 ngày
Thực tế tham gia: 20 ngày
```

Hai giá trị này không được ghi đè lên nhau.

------------------------------------------------------------------------

# 8. SNAPSHOT KỲ THÁNG

Khi tính/chốt kỳ, lưu snapshot:

``` text
Member ID
Month
Year
Days Per Week
Days In Month
Calculated Days
Calculation Formula
Created At
```

Nếu sau này thay đổi số ngày/tuần:

``` text
5 -> 4
```

không được làm thay đổi kỳ đã CLOSED.

------------------------------------------------------------------------

# 9. QUẢN LÝ LỊCH CHƠI

Tạo module:

**Lịch chơi**

Mỗi ngày chơi là một `Playing Session`.

Thông tin:

``` text
Session ID
Date
Month
Status
Total Players
Shuttle Used
Notes
Created By
Created At
Updated By
Updated At
```

Status:

``` text
PLANNED
OPEN
COMPLETED
CANCELLED
```

------------------------------------------------------------------------

# 10. THEO DÕI THÀNH VIÊN TỪNG BUỔI

Giao diện phải tương tự bảng hiện tại:

``` text
STT | Tên/Ngày | 25 | 26 | 27 | 28 | 29 | 30
------------------------------------------------
    | Số người |  9 |  3 |  3 |  5 |  7 |  0
    | Số cầu   |  3 |  4 |  4 |  3 |  4 |  0
------------------------------------------------
1   | A Thông  | ☑  | ☑  |    | ☑  | ☑  |
2   | A Lộc    | ☑  |    |    | ☑  | ☑  |
...
```

## Check thành viên

Admin click trực tiếp checkbox:

``` text
☐ -> ☑
```

Không cần mở popup.

Số người của ngày phải tự động cập nhật.

Ví dụ:

``` text
8 -> check thêm 1 người -> 9
```

Database:

``` text
playing_sessions
playing_session_members
```

`playing_session_members`:

``` text
id
session_id
member_id
attendance_status
checked_at
checked_by
```

------------------------------------------------------------------------

# 11. SỐ CẦU SỬ DỤNG MỖI BUỔI

Sau mỗi buổi, Admin nhập:

``` text
Số cầu sử dụng
```

Đây là **tổng số trái cầu của cả buổi**, không phải số cầu mỗi người.

Ví dụ:

``` text
29/09
7 người
4 trái cầu
```

Không được tính tự động:

``` text
Số người x hệ số
```

Số cầu là dữ liệu thực tế Admin xác nhận.

------------------------------------------------------------------------

# 12. CẬP NHẬT NHANH SAU BUỔI CHƠI

Có nút:

``` text
+ CẬP NHẬT BUỔI CHƠI
```

Form:

``` text
Ngày
Danh sách thành viên
Số người
Số cầu sử dụng
Ghi chú
```

Có thể nhập trực tiếp số cầu trên dòng ngày trong bảng tháng.

------------------------------------------------------------------------

# 13. LIÊN KẾT KHO CẦU

Khi ghi nhận:

``` text
25/09
Sử dụng = 3 trái
```

tạo Inventory Transaction:

``` text
Type = USAGE
Quantity = -3
Reference Type = PLAYING_SESSION
Reference ID = session_id
```

Tồn:

``` text
Tồn trước = 30
Sử dụng = 3
Tồn sau = 27
```

## Sửa số cầu

Nếu:

``` text
3 -> 4
```

chỉ trừ thêm:

``` text
4 - 3 = 1
```

Không được trừ:

``` text
-3 -4 = -7
```

## Hủy session

Nếu session dùng 5 cầu rồi bị CANCELLED:

``` text
Tồn trước = 30
Đã trừ = 5
Tồn = 25

Hủy session
=> hoàn +5
=> Tồn = 30
```

Ghi Audit Log.

------------------------------------------------------------------------

# 14. KHO CẦU

Đơn vị quản lý chính:

``` text
Ống
```

Mặc định:

``` text
1 ống = 12 trái
```

Nhưng sử dụng thực tế theo:

``` text
Trái
```

Nên lưu quantity chuẩn trong database theo `PIECE`.

Ví dụ:

``` text
10 ống
= 120 trái
```

Có thể hiển thị:

``` text
4 ống + 9 trái
```

thay vì chỉ hiển thị:

``` text
57 trái
```

------------------------------------------------------------------------

# 15. NHẬP KHO

Thông tin:

-   Ngày.
-   Tháng.
-   Nhà cung cấp.
-   Loại cầu.
-   Mã sản phẩm.
-   Số ống.
-   Số trái.
-   Đơn giá/ống.
-   Tổng tiền.
-   Ghi chú.

Ví dụ:

``` text
10 ống x 650.000
= 6.500.000
```

Tự động:

``` text
+120 trái
```

------------------------------------------------------------------------

# 16. XUẤT/SỬ DỤNG KHO

Xuất kho có thể phát sinh từ:

-   Playing Session.
-   Điều chỉnh kho.
-   Các nghiệp vụ khác nếu Admin cho phép.

Không cho xuất vượt tồn kho mặc định.

Nếu:

``` text
Tồn = 2 trái
```

mà nhập:

``` text
Sử dụng = 4
```

phải cảnh báo.

------------------------------------------------------------------------

# 17. TỒN KHO THEO THÁNG

Công thức:

``` text
Tồn cuối =
Tồn đầu
+ Nhập
- Xuất/Sử dụng
± Điều chỉnh
```

Cuối tháng:

``` text
Tồn cuối tháng N
=
Tồn đầu tháng N+1
```

Không xóa lịch sử.

Có trạng thái:

``` text
OPEN
CLOSING
CLOSED
```

------------------------------------------------------------------------

# 18. CHI PHÍ MUA CẦU

Mỗi lần mua là một transaction riêng.

Ví dụ:

``` text
05/09
10 ống x 650.000
= 6.500.000

20/09
5 ống x 670.000
= 3.350.000
```

Giá các đợt khác nhau không được làm thay đổi lịch sử.

Mỗi purchase phải liên kết:

``` text
Expense Transaction
+
Inventory Receipt
+
Purchase ID
```

------------------------------------------------------------------------

# 19. QUỸ CỐ ĐỊNH

Có 3 loại thu:

``` text
1. Quỹ cố định
2. Phí vãng lai
3. Khoản thu khác
```

Quỹ cố định phải linh hoạt theo tháng.

Có thể chọn:

### Phương pháp A -- Chia đều

``` text
Tổng chi phí / số thành viên
```

### Phương pháp B -- Theo số ngày đăng ký

``` text
Tổng chi phí
/
Tổng ngày đăng ký của tất cả thành viên
x
Ngày đăng ký của thành viên
```

### Phương pháp C -- Thủ công

Admin nhập mức phí cho từng thành viên.

------------------------------------------------------------------------

# 20. CẤU HÌNH QUỸ

Các yếu tố:

-   Chi phí sân.
-   Chi phí cầu.
-   Chi phí khác cần phân bổ.
-   Số thành viên.
-   Số ngày đăng ký/tuần.
-   Số ngày dự kiến/tháng.
-   Phương pháp tính.
-   Ngày hiệu lực.

Nên có Fee Calculation Engine.

------------------------------------------------------------------------

# 21. PHÍ VÃNG LAI

Admin cấu hình:

``` text
Tên phí
Đơn giá
Đơn vị tính
Ngày hiệu lực
```

Ví dụ:

``` text
70.000/lần chơi
```

Một người chơi 3 lần:

``` text
3 x 70.000 = 210.000
```

Có hỗ trợ thay đổi giá nhưng giá mới chỉ áp dụng từ ngày hiệu lực.

Không làm thay đổi lịch sử.

------------------------------------------------------------------------

# 22. THU KHÁC

Cho phép nhập:

``` text
Ngày
Nội dung
Số tiền
Người nộp
Ghi chú
```

------------------------------------------------------------------------

# 23. PHÍ SÂN

Admin nhập linh hoạt theo từng tháng:

``` text
Tháng
Giá sân/ngày
Số ngày
Số sân
Tổng tiền
Ghi chú
```

Ví dụ:

``` text
300.000/ngày
12 ngày
= 3.600.000
```

Không hard-code giá sân.

------------------------------------------------------------------------

# 24. CHI KHÁC

Cho phép nhập:

``` text
Ngày
Nội dung
Số tiền
Người nhận
Ghi chú
```

------------------------------------------------------------------------

# 25. QUY TẮC LÀM TRÒN TIỀN

**Tất cả số tiền phải ROUNDUP đến hàng nghìn.**

Quy tắc:

``` text
ROUNDUP(amount, -3)
```

JavaScript:

``` javascript
Math.ceil(amount / 1000) * 1000
```

Ví dụ:

``` text
774.100 -> 775.000
774.999 -> 775.000
775.000 -> 775.000
775.001 -> 776.000

1.001 -> 2.000
0 -> 0
```

Áp dụng cho:

-   Quỹ cố định.
-   Phí vãng lai.
-   Thu khác.
-   Phí sân.
-   Mua cầu.
-   Chi khác.
-   Phải đóng.
-   Còn thiếu.
-   Số tiền QR.

## Không làm tròn nhiều lần

Ưu tiên:

``` text
Tính nghiệp vụ
    ↓
Tính số tiền cuối cùng
    ↓
ROUNDUP hàng nghìn
    ↓
Lưu
```

Nên lưu:

``` text
original_amount
rounded_amount
rounding_rule
```

------------------------------------------------------------------------

# 26. LƯU LỊCH SỬ PHÍ

Mọi cấu hình phí phải có version:

``` text
Fee Version
Effective From
Effective To
Amount
Calculation Method
```

Nếu thay đổi giữa tháng:

``` text
Version 1
01/09 -> 14/09

Version 2
15/09 -> 30/09
```

Dữ liệu phát sinh trước ngày thay đổi không bị tính lại.

------------------------------------------------------------------------

# 27. QUẢN LÝ THU -- CHI

Mọi giao dịch phải có:

``` text
Transaction ID
Date
Month
Type
Category
Description
Amount
Member ID nếu có
Created By
Created At
Updated By
Updated At
```

Không chỉ lưu số tổng.

Dashboard phải tính từ transaction.

------------------------------------------------------------------------

# 28. CÔNG NỢ THÀNH VIÊN

Màn hình:

**Công nợ thành viên**

  Thành viên     Phải đóng   Đã đóng   Còn thiếu Trạng thái
  ------------ ----------- --------- ----------- ------------
  A                500.000   500.000           0 Đã đóng
  B                500.000   300.000     200.000 Còn thiếu
  C                500.000         0     500.000 Chưa đóng

Công thức:

``` text
Còn thiếu = Phải đóng - Đã đóng
```

Hỗ trợ:

-   Đóng đủ.
-   Đóng thiếu.
-   Đóng nhiều lần.
-   Chưa đóng.
-   Đóng dư.

Ví dụ:

``` text
500.000
200.000 + 300.000
= 500.000
```

------------------------------------------------------------------------

# 29. QR THANH TOÁN

Admin cấu hình:

``` text
Ngân hàng
Số tài khoản
Tên tài khoản
```

QR tự động lấy:

``` text
Amount = Khoản còn thiếu
Description = <Tên thành viên> - <Kỳ đóng>
```

Ví dụ:

``` text
Nguyễn Văn A
Còn thiếu: 350.000
Kỳ: 09/2026

Amount = 350000
Description = Nguyen Van A - 09/2026
```

Có:

-   Hiển thị QR.
-   Download QR.
-   Copy số tiền.
-   Copy số tài khoản.
-   Copy nội dung.

------------------------------------------------------------------------

# 30. DASHBOARD

Hiển thị 3 KPI chính:

``` text
TỔNG THU
TỔNG CHI
TỒN QUỸ
```

Công thức:

``` text
Tồn quỹ = Tổng thu - Tổng chi
```

Nếu âm:

``` text
màu đỏ
```

Nếu \>= 0:

``` text
màu xanh
```

------------------------------------------------------------------------

# 31. DASHBOARD THEO THÁNG

Có filter:

``` text
Tháng
Năm
```

Khi chọn tháng, toàn bộ Dashboard cập nhật.

Chi tiết Thu:

``` text
Quỹ cố định
Phí vãng lai
Khác
Tổng thu
```

Chi:

``` text
Phí sân
Phí cầu
Khác
Tổng chi
```

Có thể click từng loại để xem transaction.

------------------------------------------------------------------------

# 32. TRANG SAO KÊ CÔNG KHAI

Route:

``` text
/saoke
```

Không yêu cầu đăng nhập.

Mục đích:

> Thành viên chỉ cần bấm link hoặc quét QR là xem được báo cáo quỹ.

Trang phải read-only.

Không có:

-   Edit.
-   Delete.
-   POST.
-   PUT.
-   PATCH.

Public API chỉ cho phép GET các dữ liệu cần thiết.

Không expose:

-   Số điện thoại.
-   Email.
-   API key.
-   Token.
-   Tài khoản cá nhân.
-   Admin data.
-   Audit data.

------------------------------------------------------------------------

# 33. GIAO DIỆN SAO KÊ

Phong cách theo mẫu dashboard được cung cấp:

``` text
QUỸ 5AM - RISE & SHINE

BÁO CÁO THU • CHI • TỒN

Tổng hợp quỹ • Chi tiết từng khoản chi
```

Đầu trang:

``` text
Kỳ báo cáo:
[ 09/2026 ▼ ]
```

Sau khi chọn tháng:

``` text
TỔNG THU
10.600.000 đ

TỔNG CHI
10.604.000 đ

TỒN QUỸ
-4.000 đ
```

------------------------------------------------------------------------

# 34. CHI TIẾT THU TRÊN SAO KÊ

  Nội dung khoản thu      SL   Giá   Thành tiền   Tỷ trọng
  -------------------- ----- ----- ------------ ----------
  Quỹ cố định            ...   ...          ...        ...
  Phí vãng lai           ...   ...          ...        ...
  Thu khác               ...   ...          ...        ...
  **TỔNG THU**                          **...**   **100%**

------------------------------------------------------------------------

# 35. CHI TIẾT CHI TRÊN SAO KÊ

  Nội dung khoản chi      SL   Giá   Thành tiền   Tỷ trọng
  -------------------- ----- ----- ------------ ----------
  Phí sân                ...   ...          ...        ...
  Mua cầu                ...   ...          ...        ...
  Chi khác               ...   ...          ...        ...
  **TỔNG CHI**                          **...**   **100%**

SL/Giá phải phụ thuộc loại transaction.

Ví dụ:

``` text
Phí sân:
SL = số ngày
Giá = giá/ngày

Mua cầu:
SL = số ống
Giá = giá/ống

Chi khác:
SL = 1
Giá = số tiền
```

Tỷ trọng:

``` text
Thành tiền / Tổng Thu hoặc Tổng Chi * 100
```

------------------------------------------------------------------------

# 36. SAO KÊ -- MOBILE

Phải responsive.

Trên mobile:

``` text
Tổng Thu
Tổng Chi
Tồn Quỹ
Chọn tháng
Chi tiết Thu
Chi tiết Chi
```

Bảng rộng có thể chuyển thành Card.

------------------------------------------------------------------------

# 37. CHIA SẺ SAO KÊ

Admin có:

``` text
Copy Link Sao kê
Generate QR
```

QR chứa URL `/saoke`.

Thành viên:

``` text
Quét QR
  ↓
Mở Sao kê
  ↓
Chọn tháng
  ↓
Xem Thu/Chi/Tồn
```

------------------------------------------------------------------------

# 38. THỐNG KÊ BUỔI CHƠI TRÊN SAO KÊ

Có thể hiển thị:

``` text
Số buổi chơi
Tổng lượt tham gia
Tổng cầu sử dụng
Tồn kho cầu
```

Không bắt buộc hiển thị tên từng thành viên trên public page.

------------------------------------------------------------------------

# 39. BÁO CÁO SỬ DỤNG CẦU

Theo tháng:

``` text
Số buổi chơi
Tổng lượt tham gia
Tổng cầu sử dụng
Trung bình cầu/buổi
Trung bình cầu/lượt
```

Bảng:

  Ngày         Số người   Số cầu   Cầu/người Trạng thái
  ---------- ---------- -------- ----------- ------------
  25/09               9        3        0.33 Hoàn thành
  26/09               3        4        1.33 Hoàn thành
  27/09               3        4        1.33 Hoàn thành
  28/09               5        3        0.60 Hoàn thành
  29/09               7        4        0.57 Hoàn thành
  **Tổng**       **27**   **18**             

`Cầu/người` chỉ là chỉ số thống kê, không dùng để tính tiền.

------------------------------------------------------------------------

# 40. BÁO CÁO THEO THÀNH VIÊN

    STT Thành viên     Số buổi tham gia   Tỷ lệ tham gia
  ----- ------------ ------------------ ----------------
      1 A Thông                       5             100%
      2 A Lộc                         4              80%
      3 A Nguyên                      3              60%

Đây là lượt tham gia thực tế.

------------------------------------------------------------------------

# 41. DASHBOARD ADMIN -- HOẠT ĐỘNG

Bổ sung:

``` text
Buổi chơi
Lượt tham gia
Cầu sử dụng
Tồn cầu
```

Có biểu đồ:

``` text
Cầu sử dụng theo ngày
```

------------------------------------------------------------------------

# 42. CHỐT THÁNG

Trạng thái:

``` text
OPEN
CLOSING
CLOSED
```

Khi CLOSED:

-   Không sửa transaction thông thường.
-   Không sửa phí.
-   Không sửa attendance.
-   Không sửa số cầu.
-   Không sửa tồn.
-   Không xóa session.
-   Chỉ Admin có quyền mở khóa.

Mọi thao tác mở khóa phải Audit Log.

------------------------------------------------------------------------

# 43. AUDIT LOG

Ghi:

``` text
User
Action
Module
Record ID
Old Value
New Value
Timestamp
IP nếu có
```

Đặc biệt:

-   Xóa/void transaction.
-   Sửa số tiền.
-   Sửa phí.
-   Sửa tồn.
-   Sửa số cầu.
-   Sửa attendance.
-   Chốt tháng.
-   Mở khóa tháng.

Không hard-delete transaction tài chính.

Dùng:

``` text
VOID / CANCEL
```

------------------------------------------------------------------------

# 44. DATABASE SCHEMA ĐỀ XUẤT

``` text
users
members
member_types

playing_sessions
playing_session_members

fee_configs
fee_versions
member_fees
payments

income_transactions
expense_transactions

court_fee_configs
shuttle_purchases

inventory_products
inventory_receipts
inventory_receipt_items
inventory_issues
inventory_issue_items
inventory_transfers
inventory_transactions
inventory_monthly_balances

bank_accounts

monthly_closing
monthly_report_snapshots

audit_logs
```

Có thể thay đổi schema nếu thiết kế tốt hơn, nhưng phải giữ đúng nghiệp
vụ.

------------------------------------------------------------------------

# 45. TRANSACTION & DATABASE PRINCIPLE

Không lưu chỉ số tổng như:

``` text
balance = 10000000
```

mà không có transaction.

Ưu tiên:

``` text
Transaction
    ↓
Aggregate
    ↓
Dashboard
```

Dashboard phải lấy dữ liệu thật từ DB/API.

Không sử dụng mock data trong Production.

------------------------------------------------------------------------

# 46. MONTHLY REPORT SNAPSHOT

Khi kỳ CLOSED có thể tạo snapshot:

``` text
monthly_reports
----------------
id
month
total_income
total_expense
balance
income_breakdown
expense_breakdown
inventory_summary
generated_at
closed_at
```

Transaction gốc vẫn giữ để audit.

------------------------------------------------------------------------

# 47. VALIDATION

Phải kiểm tra:

-   Không số tiền âm.
-   Không xuất kho vượt tồn.
-   Không thanh toán âm.
-   Không duplicate payment.
-   Không duplicate member.
-   Không duplicate transaction.
-   Không cho days_per_week \> 7.
-   Không cho dữ liệu kỳ CLOSED sửa bởi user thường.
-   Không cho QR amount sai công nợ.
-   Không cho negative inventory mặc định.

------------------------------------------------------------------------

# 48. EXPORT

Hỗ trợ:

-   Excel.
-   CSV.
-   PDF.

Báo cáo:

-   Thành viên.
-   Thu theo tháng.
-   Chi theo tháng.
-   Thu -- Chi -- Tồn.
-   Công nợ.
-   Lịch sử thanh toán.
-   Nhập -- Xuất -- Tồn.
-   Sử dụng cầu.
-   Lịch chơi.

------------------------------------------------------------------------

# 49. BACKUP / RESTORE

Admin có thể:

-   Backup database.
-   Restore database.

SQLite backup phải bảo toàn toàn bộ dữ liệu.

------------------------------------------------------------------------

# 50. DEMO DATA

Seed:

-   10 thành viên cố định.
-   5 thành viên vãng lai.
-   Lịch chơi 1 tháng.
-   Thu cố định.
-   Thu vãng lai.
-   Thu khác.
-   Chi sân.
-   Mua cầu nhiều đợt.
-   Chi khác.
-   Tồn kho.
-   Một số thành viên đã đóng đủ.
-   Một số đóng một phần.
-   Một số chưa đóng.
-   Playing Session có attendance.
-   Số cầu sử dụng từng buổi.

------------------------------------------------------------------------

# 51. TEST CASE BẮT BUỘC

## Ngày chơi

``` text
10/2026
5 ngày/tuần
=> 23 ngày
```

## Làm tròn

``` text
774100 => 775000
```

## Attendance

``` text
10 member
7 checked
=> 7 players
```

## Sửa số cầu

``` text
3 -> 4
=> inventory chỉ giảm thêm 1
```

## Hủy session

``` text
5 cầu đã trừ
cancel
=> hoàn lại 5
```

## Nhiều payment

``` text
200.000 + 300.000 = 500.000
```

## Fee version

Thay đổi phí giữa tháng không làm thay đổi lịch sử.

## Inventory

``` text
Opening + Import - Usage = Closing
```

## Monthly closing

Kỳ CLOSED không bị thay đổi bởi cấu hình mới.

## Sao kê

Chọn tháng phải hiển thị đúng:

``` text
Thu
Chi
Tồn
Chi tiết Thu
Chi tiết Chi
```

------------------------------------------------------------------------

# 52. UI MENU

``` text
Dashboard

Thành viên
  ├── Thành viên cố định
  └── Thành viên vãng lai

Lịch chơi
Theo dõi buổi chơi

Quỹ & Thu
  ├── Quỹ cố định
  ├── Phí vãng lai
  └── Thu khác

Chi phí
  ├── Phí sân
  ├── Mua cầu
  └── Chi khác

Kho cầu
  ├── Nhập kho
  ├── Xuất/Sử dụng
  ├── Tồn kho
  └── Chuyển kho

Công nợ
Thanh toán
Báo cáo sử dụng cầu
Báo cáo Thu – Chi – Tồn

Sao kê
Cấu hình
  ├── Tài khoản ngân hàng
  ├── Cấu hình phí
  ├── Làm tròn tiền
  └── Người dùng

Audit Log
Backup / Restore
```

------------------------------------------------------------------------

# 53. WORKFLOW PHÁT TRIỂN

## Phase 1

-   Project setup.
-   Database.
-   Migration.
-   Authentication.
-   RBAC.
-   Members.

## Phase 2

-   Playing Session.
-   Attendance.
-   Số cầu sử dụng.
-   Inventory integration.

## Phase 3

-   Fee Engine.
-   Fixed Fund.
-   Visitor Fee.
-   Income.
-   Payment.
-   Debt.

## Phase 4

-   Court Expense.
-   Shuttle Purchase.
-   Other Expense.
-   Cash Balance.

## Phase 5

-   Dashboard.
-   Sao kê.
-   Reports.
-   QR.

## Phase 6

-   Monthly closing.
-   Audit.
-   Backup/Restore.
-   Export.
-   Security.
-   Responsive.

Sau mỗi phase:

1.  Run.
2.  Test DB.
3.  Test API.
4.  Test UI.
5.  Fix bugs.
6.  Chỉ chuyển phase khi phase hiện tại hoạt động.

------------------------------------------------------------------------

# 54. GITHUB PAGES DEPLOYMENT

Repository nên có:

``` text
badminton-fund/
├── frontend/
├── backend/
├── database/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

Frontend phải build được để deploy GitHub Pages.

Backend phải chạy độc lập.

Không phụ thuộc vào GitHub Pages để lưu dữ liệu.

------------------------------------------------------------------------

# 55. PUBLIC API

Cho phép GET:

``` text
GET /api/public/months
GET /api/public/report?month=YYYY-MM
GET /api/public/summary?month=YYYY-MM
GET /api/public/expense-detail?month=YYYY-MM
GET /api/public/income-detail?month=YYYY-MM
```

Không public:

``` text
POST
PUT
PATCH
DELETE
```

Admin API phải được bảo vệ authentication/authorization.

------------------------------------------------------------------------

# 56. ACCEPTANCE CRITERIA CUỐI CÙNG

Phần mềm chỉ được coi là hoàn thành khi:

-   [ ] Thành viên cố định.
-   [ ] Thành viên vãng lai.
-   [ ] Ngày đăng ký/tuần.
-   [ ] Tự tính ngày/tháng bằng ROUNDUP.
-   [ ] Phân biệt ngày dự kiến và ngày thực tế.
-   [ ] Lịch chơi.
-   [ ] Check thành viên từng buổi.
-   [ ] Tự đếm số người/ngày.
-   [ ] Nhập số cầu thực tế từng buổi.
-   [ ] Liên kết số cầu với kho.
-   [ ] Không trừ kho hai lần khi sửa.
-   [ ] Hoàn kho khi hủy session.
-   [ ] Báo cáo cầu theo tháng.
-   [ ] Quỹ cố định.
-   [ ] Phí vãng lai.
-   [ ] Thu khác.
-   [ ] Phí sân.
-   [ ] Mua cầu.
-   [ ] Chi khác.
-   [ ] Fee version/effective date.
-   [ ] ROUNDUP tiền hàng nghìn.
-   [ ] Công nợ.
-   [ ] Thanh toán một phần/nhiều lần.
-   [ ] QR thanh toán.
-   [ ] Dashboard.
-   [ ] Chọn tháng.
-   [ ] Chi tiết Thu.
-   [ ] Chi tiết Chi.
-   [ ] Tồn quỹ.
-   [ ] Trang `/saoke`.
-   [ ] Public read-only.
-   [ ] Responsive mobile.
-   [ ] Chia sẻ link/QR Sao kê.
-   [ ] Monthly closing.
-   [ ] Audit Log.
-   [ ] Export.
-   [ ] Backup/Restore.
-   [ ] SQLite.
-   [ ] Docker.
-   [ ] GitHub Pages frontend.
-   [ ] Backend API.
-   [ ] Không mock data trong Production.

------------------------------------------------------------------------

# 57. NGUYÊN TẮC BẮT BUỘC CHO ANTIGRAVITY

1.  Không chỉ dựng UI mockup.
2.  Phải xây dựng ứng dụng end-to-end.
3.  Không hard-code số liệu Dashboard.
4.  Không dùng fake API.
5.  Không dùng mock data sau khi module đã kết nối database.
6.  Không dùng LocalStorage làm database chính.
7.  Không làm mất lịch sử.
8.  Không tự ý thay đổi công thức nghiệp vụ.
9.  Nếu nghiệp vụ chưa rõ, dừng tại điểm đó và đề xuất phương án trước
    khi code.
10. Phải viết test cho các công thức và nghiệp vụ quan trọng.
11. Ưu tiên tính đúng dữ liệu hơn UI.
12. Mọi thay đổi tài chính phải có khả năng audit.
13. Dữ liệu CLOSED phải bất biến đối với user thông thường.
14. Mọi số tiền phải áp dụng ROUNDUP hàng nghìn theo quy tắc đã nêu.
15. Mọi số ngày dự kiến của thành viên cố định phải áp dụng đúng công
    thức ROUNDUP.

------------------------------------------------------------------------

# 58. DELIVERABLE

Sau khi hoàn thành phải cung cấp:

``` text
Source Code
Database Schema
Migration
Seed Data
Dockerfile
docker-compose.yml
.env.example
README.md
API Documentation
Test Cases
GitHub Pages Deployment Guide
Backend Deployment Guide
Backup/Restore Guide
```

README phải hướng dẫn:

1.  Cài đặt.
2.  Cấu hình ENV.
3.  Migration.
4.  Seed.
5.  Chạy local.
6.  Chạy Docker.
7.  Deploy frontend GitHub Pages.
8.  Deploy backend.
9.  Backup.
10. Restore.
11. Update version.

------------------------------------------------------------------------

# 59. FINAL PRODUCT FLOW

## ADMIN

``` text
Login
  ↓
Quản lý thành viên
  ↓
Cấu hình ngày/tuần
  ↓
Tự tính ngày/tháng
  ↓
Quản lý lịch chơi
  ↓
Check thành viên
  ↓
Nhập số cầu thực tế
  ↓
Kho cầu tự cập nhật
  ↓
Thu / Chi
  ↓
Tính quỹ
  ↓
Công nợ
  ↓
QR thanh toán
  ↓
Dashboard
  ↓
Chốt tháng
```

## MEMBER

``` text
Mở link / quét QR
      ↓
    /saoke
      ↓
Chọn tháng
      ↓
Tổng Thu
Tổng Chi
Tồn Quỹ
      ↓
Chi tiết Thu
Chi tiết Chi
      ↓
Thống kê hoạt động
```

------------------------------------------------------------------------

# 60. YÊU CẦU CUỐI CÙNG

Hãy đọc toàn bộ tài liệu này trước khi bắt đầu code.

Không được bỏ qua các yêu cầu liên quan đến:

-   Lịch sử.
-   Fee Version.
-   Effective Date.
-   Monthly Closing.
-   Attendance.
-   Shuttle Usage.
-   Inventory.
-   ROUNDUP ngày.
-   ROUNDUP tiền.
-   Công nợ.
-   QR.
-   Public Sao kê.
-   GitHub Pages + Backend + SQLite.

Nếu cần quyết định kỹ thuật, ưu tiên:

``` text
Correctness
>
Data Integrity
>
Auditability
>
Maintainability
>
Security
>
UX
>
Visual polish
```

**Mục tiêu là xây dựng một hệ thống quản lý quỹ cầu lông thực tế, có dữ
liệu thật, có lịch sử, có thể triển khai và sử dụng lâu dài; không phải
một UI demo.**
