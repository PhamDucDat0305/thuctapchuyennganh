# Lộ trình cải thiện

Ưu tiên dựa trên source/log đã biết. Các mục profile privacy, 2FA UI disable, Firebase removal, rate limiting, employer companyName và CV text label đã được sửa trong code; các mục còn lại chưa hoàn thành hoặc cần xác minh runtime/schema.

## P0 — Làm trước khi đưa lên môi trường dùng thật

| Việc | Vấn đề gốc / lợi ích | Modules | Phụ thuộc/rủi ro | Xác minh |
|---|---|---|---|---|
| Xoay credentials đã dán trong trao đổi | Có khả năng credential DB/session bị lộ; giảm nguy cơ truy cập trái phép. | `.env` local, SQL login, deployment secrets | Cần cập nhật mọi môi trường, restart sessions có thể mất đăng nhập. | Xác nhận secret mới hoạt động, old SQL login/password vô hiệu; không ghi secret vào log/commit. |
| **Đã sửa trong code:** quyền xem profile theo privacy | `GET /users/:id` áp dụng self/admin/employer visibility và relationship. | `users.routes.js`, profile UI | Policy hiện cho employer đã ứng tuyển xem profile ẩn; invite chưa được tính là quan hệ. | Còn cần xác minh ma trận candidate/employer/admin trên staging. |
| **Đã sửa trong code:** gỡ Firebase auto migration | Client không còn upload dữ liệu localStorage lên Firebase hoặc xóa key local. | `js/db.js`; `firebase-config.js` đã xóa | Dữ liệu localStorage cũ được giữ nguyên; migration sang SQL nếu cần phải có thao tác riêng. | Kiểm tra DevTools Network không có request Firebase/CDN liên quan. |

## P1 — Tính đúng và giảm rủi ro nghiệp vụ

| Việc | Vấn đề gốc / lợi ích | Modules | Phụ thuộc/rủi ro | Xác minh |
|---|---|---|---|---|
| **Đã sửa một phần:** tắt UI 2FA giả | UI ghi chưa khả dụng; API từ chối đổi cờ. MFA thật chưa có. | `security.html`, `me.routes.js` | Cần chọn TOTP/email factor, recovery và lockout khi bắt đầu triển khai MFA. | Chỉ xác nhận hoàn tất khi login yêu cầu factor thật. |
| Định nghĩa baseline SQL Server và migration có phiên bản | Thiếu DDL core, migrations không xác nhận đầy đủ existing schema. | `backend/sql`, runbook | Cần xuất/đối chiếu schema thật; migration có thể tác động dữ liệu hiện hữu. | Tạo DB disposable từ đầu và nâng cấp bản sao legacy; schema assertions pass. |
| **Đã thêm rate limits cơ bản:** hoàn thiện deployment controls | Giới hạn hiện tại nằm trong process; chưa có Helmet/security headers/CSRF. | `app.js`, middleware rateLimit, reverse proxy/deploy config | Cần domain/origin/reverse proxy thật; nhiều instance cần shared store. | Kiểm tra 429/CORS/CSRF/cookie flags và headers trên staging. |
| **Đã sửa trong code:** employer khai tên công ty thật | Form đăng ký employer có trường companyName bắt buộc theo role. | `auth.html`, `js/auth.js`, `auth.routes.js` | Cần xác nhận registration lưu đúng `dbo.companies.name`. | Tạo employer test rồi xem record company. |

## P2 — Khả năng bảo trì và hiệu năng

| Việc | Lợi ích | Modules | Phụ thuộc/rủi ro | Xác minh |
|---|---|---|---|---|
| Thêm test integration/role matrix | Bắt hồi quy API/SQL, đặc biệt lỗi schema/ownership đã gặp. | Routes, SQL Server test DB, frontend smoke | Cần disposable DB và fixtures giả. | CI chạy test lặp lại; báo cáo pass/fail rõ; không dùng production data. |
| Pagination cho list APIs | Giới hạn response/heap khi số users/jobs/apps tăng. | jobs, applications, users, interviews, invites, saved/profile views | Frontend cần hỗ trợ cursor/page; sort ổn định. | Test page boundary, duplicates/missing rows, execution plan. |
| Tối ưu conversations list và xem actual query plans | Giảm scan/window aggregate trên toàn message history. | `messages.routes.js`, indexes | Chỉ thêm index sau đo trên staging; write cost/storage tradeoff. | Benchmark dataset giả và logical reads/latency trước/sau. |
| Làm rõ lifecycle session/password | Đổi password có thể cần revoke sessions; kiểm tra log “Connection is closed” từng báo. | session helpers/store/auth | Đảm bảo shutdown drain request; phụ thuộc behavior package thực tế. | Load/restart/expire session test trên staging SQL. |
| Loại bỏ các message branding/comment legacy không còn đúng | Header trong `js/db.js` nói Firestore dù hầu hết gọi API; giảm nhầm lẫn bảo trì. | `js/db.js` | Kiểm tra consumer trước khi bỏ. | Static search không còn Firebase nếu mục tiêu bỏ hoàn toàn. |

## P3 — Mở rộng có căn cứ

- Xem xét service layer/validation library/OpenAPI khi số route/thành viên tăng; hiện một Express app và parameterized SQL trực tiếp vẫn là kiến trúc đơn giản hợp lý.
- Thiết kế retention/archive cho message chỉ sau khi có số liệu dung lượng, thời hạn pháp lý/sản phẩm, backup và yêu cầu tra cứu; hiện không có job dọn dữ liệu.
- Thêm observability (request ID, structured logs, metrics) và CI/deploy pipeline sau khi xác định môi trường host.
- Không có bằng chứng hiện tại bắt buộc phải chuyển microservices, thêm Redis/MongoDB hoặc thay framework.
