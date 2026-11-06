# JobViệt — tài liệu project

JobViệt là website tuyển dụng gồm giao diện ứng viên, nhà tuyển dụng và API dùng SQL Server.

## Chức năng

- Khách tìm kiếm, lọc và xem tin tuyển dụng.
- Ứng viên tạo tài khoản sau khi xác minh email bằng OTP; cập nhật hồ sơ, ứng tuyển, theo dõi trạng thái, lưu tin, xem lịch phỏng vấn, nhắn tin và quản lý lời mời.
- Nhà tuyển dụng đăng/quản lý tin và công ty, xem hồ sơ/đơn ứng tuyển, cập nhật trạng thái, đặt lịch phỏng vấn, nhắn tin, gửi lời mời và xem thống kê.
- Phiên đăng nhập được lưu trong SQL Server. Mã đăng ký cần xác minh email qua SMTP; đăng nhập hiện vẫn dùng email và mật khẩu.

## Công nghệ

- Frontend: HTML, CSS, JavaScript ES modules; API client trong `js/api.js`, lớp dữ liệu trong `js/db.js`, xác thực giao diện trong `js/auth.js`.
- Backend: Node.js, Express, `mssql`, `express-session`, `connect-mssql-v2`, `argon2`, `nodemailer`.
- Database: SQL Server, schema `dbo`.
- Email đăng ký: SMTP qua Nodemailer; OTP được HMAC bằng `OTP_SECRET`.

## Thư mục

- `backend/src/routes/`: API nghiệp vụ, bao gồm `auth-email.routes.js`.
- `backend/src/config/`: pool SQL, session và SMTP.
- `backend/src/services/emailService.js`: nội dung và gửi thư OTP.
- `backend/src/utils/otp.js`: sinh và kiểm tra mã OTP.
- `backend/sql/`: các migration SQL Server.
- `docs/PROJECT_FILE_GUIDE.md`: hướng dẫn đọc backend và JavaScript theo chức năng/liên kết module.

## Chạy local

1. Trong `backend/`, chạy `npm install`.
2. Sao chép `.env.example` thành `.env`; cấu hình SQL Server, SMTP và `OTP_SECRET` riêng cho môi trường.
3. Đảm bảo các bảng được API sử dụng đã tồn tại. Các migration trong repo không tạo toàn bộ schema lõi; `dbo.email_verifications` hiện chưa có migration đi kèm.
4. Chạy `npm run dev` trong `backend/` và phục vụ frontend qua web server tĩnh ở origin có trong `FRONTEND_ORIGINS`.
5. Dùng `npm run test:mail` để kiểm tra xác thực SMTP. Lệnh này không gửi thư; việc gửi OTP thật cần thử bằng email test.

## Tài liệu chi tiết

- [Danh sách chức năng](FEATURES.md)
- [Kiến trúc và luồng dữ liệu](ARCHITECTURE.md)
- [API](API_DOCUMENTATION.md)
- [Database](DATABASE.md)
- [Cấu hình và chạy](RUN_AND_DEPLOY.md)
- [Dependency](TECH_STACK.md)
- [Bảo mật](SECURITY_AUDIT.md)
- [Vấn đề còn tồn tại](BUGS_AND_ISSUES.md)
- [Lộ trình](IMPROVEMENT_ROADMAP.md)
- [Kiểm thử](TESTING.md) và [checklist thủ công](CHECKLIST_TEST_CHUC_NANG.md)

## Phạm vi xác minh

Tài liệu mô tả hành vi trong source. Các truy vấn SQL, migration và luồng giao diện cần được kiểm tra trên database/môi trường chạy thực tế trước khi triển khai. Kết nối SMTP có lệnh kiểm tra riêng, nhưng `transporter.verify()` không xác nhận email OTP đã đến mailbox; cần kiểm thử gửi/nhận thật theo checklist.
