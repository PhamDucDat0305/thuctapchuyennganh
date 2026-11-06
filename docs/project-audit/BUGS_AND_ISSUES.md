# Vấn đề còn tồn tại

Danh sách này chỉ ghi nhận rủi ro hoặc thiếu sót còn hiện diện trong source/repo. Đây là review tĩnh; các dòng liên quan SQL/SMTP cần xác minh trên môi trường test.

| ID | Tồn tại | Ảnh hưởng | Việc cần làm |
|---|---|---|---|
| ISSUE-001 | Repo thiếu DDL tạo schema lõi `dbo.users`, `dbo.jobs`, `dbo.companies`; cũng chưa có migration cho `dbo.email_verifications`. | Không thể dựng database mới chỉ bằng các file SQL trong repo; đăng ký OTP phụ thuộc bảng đã tạo thủ công. | Version hóa baseline và migration `email_verifications`; kiểm tra upgrade trên bản sao database. |
| ISSUE-002 | Các migration không có migration ledger/rollback thống nhất; nhiều script chỉ bỏ qua khi bảng đã tồn tại. | Database cũ có thể thiếu cột/index dù tên bảng đã tồn tại. | Thêm preflight và schema assertions, sau đó kiểm tra fresh install và upgrade riêng. |
| ISSUE-003 | Rate limit lưu trong RAM từng process. | Quota không được chia sẻ giữa nhiều instance và mất sau khi restart. | Dùng shared store hoặc reverse-proxy limit khi triển khai nhiều instance. |
| ISSUE-004 | Nhiều API danh sách không phân trang; danh sách hội thoại cần aggregate trên lịch sử tin nhắn. | Thời gian truy vấn và lượng dữ liệu trả về tăng khi database lớn. | Thêm cursor pagination, giới hạn page size và đo execution plan bằng dữ liệu test. |
| ISSUE-005 | Lời mời có thể bị tạo trùng bởi hai request đồng thời nếu chỉ dựa vào kiểm tra trước khi insert. | Một cặp employer/candidate có thể nhận lời mời pending trùng. | Chốt định nghĩa unique cho lời mời và bổ sung constraint/transaction phù hợp. |
| ISSUE-006 | Cấu hình SMTP được kiểm tra bằng `transporter.verify()`, nhưng lệnh `test:mail` không gửi thư. | Kết nối SMTP thành công chưa chứng minh OTP thực sự tới inbox/spam hoặc xử lý bounce đúng. | Gửi thư thử tới mailbox kiểm soát; xác minh inbox, spam, sender policy và log lỗi. |
| ISSUE-007 | Email verification không có hàng đợi gửi thư hoặc retry nền. | Khi SMTP lỗi tạm thời, request gửi mã thất bại; route làm challenge vừa ghi hết hạn. | Chỉ bổ sung queue/retry khi nhu cầu vận hành yêu cầu; phải giữ giới hạn gửi và tính dùng một lần. |
| ISSUE-008 | Upload file CV, reset mật khẩu, MFA challenge, thông báo email cho thao tác tuyển dụng chưa có luồng hoàn chỉnh trong source. | Các thao tác này chưa dùng được như chức năng sản phẩm. | Thiết kế và triển khai từng luồng riêng; hiện email chỉ dùng cho OTP đăng ký. |

## Kiểm tra trước khi triển khai

- Đối chiếu schema thật với các truy vấn và migrations trong `backend/sql/`.
- Gửi OTP thật trên mailbox test; không chỉ dựa vào `npm run test:mail`.
- Chạy kiểm thử quyền sở hữu, duplicate application/invite và giới hạn request trên database dùng dữ liệu giả.
- Không dùng dữ liệu production hoặc thông tin đăng nhập thật trong các thử nghiệm.
