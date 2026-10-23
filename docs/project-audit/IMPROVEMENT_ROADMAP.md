# Lộ trình cải thiện

Ưu tiên dựa trên source/log đã biết; chưa thay đổi code hay database trong audit.

## P0 — Làm trước khi đưa lên môi trường dùng thật

| Việc | Vấn đề gốc / lợi ích | Modules | Phụ thuộc/rủi ro | Xác minh |
|---|---|---|---|---|
| Xoay credentials đã dán trong trao đổi | Có khả năng credential DB/session bị lộ; giảm nguy cơ truy cập trái phép. | `.env` local, SQL login, deployment secrets | Cần cập nhật mọi môi trường, restart sessions có thể mất đăng nhập. | Xác nhận secret mới hoạt động, old SQL login/password vô hiệu; không ghi secret vào log/commit. |
| Sửa quyền xem profile theo privacy | `GET /users/:id` bỏ qua `search_status`; bảo vệ ứng viên ẩn. | `users.routes.js`, profile UI | Cần quyết định employer đã có application/invite có được xem sau khi ẩn không. | Ma trận candidate/employer/admin × owner/hidden/discoverable/relationship. |
| Gỡ Firebase auto migration hoặc đóng phạm vi migration | Có nhánh upload dữ liệu localStorage lên Firebase và xóa bản local. | `js/db.js`, `firebase-config.js`, HTML imports | Trước xóa phải tìm consumer `FirebaseFirestore` và quyết định dữ liệu local legacy cần giữ ở đâu. | DevTools Network không gọi Firebase; seed dữ liệu giả; không xóa local user data. |

## P1 — Tính đúng và giảm rủi ro nghiệp vụ

| Việc | Vấn đề gốc / lợi ích | Modules | Phụ thuộc/rủi ro | Xác minh |
|---|---|---|---|---|
| Tạm bỏ UI 2FA hoặc triển khai MFA thật | Cờ hiện không đổi luồng login; tránh cảm giác an toàn giả. | `security.html`, `me.routes.js`, `auth.routes.js`, schema mới nếu cần | Cần chọn TOTP/email factor, recovery, lockout; không nên chỉ thêm OTP demo. | Login thực sự yêu cầu factor khi bật; recovery/disable có kiểm soát; test session. |
| Định nghĩa baseline SQL Server và migration có phiên bản | Thiếu DDL core, migrations không xác nhận đầy đủ existing schema. | `backend/sql`, runbook | Cần xuất/đối chiếu schema thật; migration có thể tác động dữ liệu hiện hữu. | Tạo DB disposable từ đầu và nâng cấp bản sao legacy; schema assertions pass. |
| Thêm rate limiting, security headers, CSRF/deployment config | Không có throttling/Helmet/CSRF; cookie session. | `app.js`, auth routes, deploy config | Cần origin/domain/reverse proxy thật; không khóa người dùng NAT quá mạnh. | Automated tests cho 429/CORS/CSRF/cookie flags; headers scan staging. |
| Chuẩn hóa employer company registration | Form gán tên company giả từ fullName. | `auth.html`, `js/auth.js`, `auth.routes.js` | Có thể ảnh hưởng form hiện tại/user onboarding. | Employer khai companyName thật hoặc hoàn tất bước profile setup. |

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
