# Lộ trình phát triển

Danh sách dưới đây chỉ gồm công việc còn cần làm hoặc cần quyết định. Email hiện chỉ dùng để xác minh tài khoản đăng ký; thông báo về ứng tuyển, phỏng vấn và trạng thái tuyển dụng chưa được triển khai.

## P0 — Trước khi mở cho người dùng thật

| Việc | Lý do | Phụ thuộc | Cách xác nhận |
|---|---|---|---|
| Tạo DDL có phiên bản cho schema lõi và `dbo.email_verifications` | Repo hiện không dựng được database sạch; OTP route phụ thuộc bảng email verification nhưng không có migration. | Đối chiếu schema đang chạy và các route sử dụng. | Tạo database test từ đầu và nâng cấp bản sao schema cũ; so sánh columns, indexes, keys. |
| Xác nhận gửi OTP end-to-end | `test:mail` chỉ xác thực SMTP, không gửi thư. | Mailbox test, sender/domain policy. | Gửi mã tới inbox test; kiểm tra inbox/spam, thời hạn, resend cooldown và đường lỗi SMTP. |
| Quản lý secret theo môi trường | SMTP, SQL Server, session và OTP cần secret riêng theo môi trường. | Cập nhật `.env` và secret store ở môi trường triển khai. | Dùng giá trị ngẫu nhiên đủ mạnh; không ghi secret vào git/log; có quy trình luân chuyển định kỳ. |
| Kiểm thử quyền sở hữu và quyền riêng tư | API chứa thông tin ứng viên, tin tuyển dụng và application. | Tài khoản candidate/employer giả và database test. | Chạy ma trận role/owner với ID của tài khoản khác; API phải từ chối truy cập trái quyền. |

## P1 — Độ tin cậy và bảo mật

| Việc | Lý do | Phụ thuộc | Cách xác nhận |
|---|---|---|---|
| Chuẩn hóa migration có version, preflight và assertion | Script hiện có xử lý khác nhau khi bảng/cột đã tồn tại. | Baseline schema và bản sao DB đại diện. | Chạy lặp và upgrade; xác nhận không bỏ sót cột/index hoặc làm mất dữ liệu. |
| Dùng shared rate-limit store khi chạy nhiều instance | Middleware hiện giữ counter trong RAM từng process. | Hạ tầng nhiều instance; lựa chọn store phù hợp. | Gửi request qua nhiều instance và xác nhận quota dùng chung. |
| Chốt quy tắc lưu và duyệt email notifications | Chưa có email nghiệp vụ ngoài mã xác minh đăng ký. | Danh sách sự kiện, tùy chọn nhận thư, template và SMTP delivery policy. | Gửi thư test cho từng sự kiện; không gửi dữ liệu nhạy cảm ngoài nhu cầu. |
| Xây luồng reset password và MFA nếu sản phẩm yêu cầu | Source hiện chưa có reset password hoặc MFA challenge. | Thiết kế token/recovery, rate limits, session revocation. | Kiểm thử hết hạn, dùng một lần, khôi phục và đăng nhập sau thay đổi. |
| Thêm chiến lược security headers/CSRF và cấu hình production proxy | Cấu hình hiện cần được chốt theo domain và topology triển khai. | Domain, HTTPS termination, reverse proxy. | Kiểm tra cookie flags, CORS, CSRF và headers trên staging. |

## P2 — Quy mô và bảo trì

- Thêm cursor pagination cho jobs, applications, candidates, invites, interviews và saved/profile views.
- Tối ưu danh sách hội thoại sau khi đo execution plan/IO với dữ liệu giả quy mô lớn.
- Bổ sung integration tests cho auth, OTP, ownership, application lifecycle, interview và message pagination.
- Thiết kế archive/retention cho tin nhắn khi có yêu cầu lưu trữ, thời hạn và chính sách backup cụ thể.
- Thêm structured logs/request ID và pipeline CI sau khi xác định môi trường deploy.
