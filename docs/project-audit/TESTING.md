# Kiểm thử

## Scripts hiện có

Chạy trong thư mục `backend/`:

| Lệnh | Phạm vi |
|---|---|
| `npm run test:frontend` | Smoke test Express host frontend, static assets, health route, JSON 404 và từ chối đường dẫn/file nội bộ. Không truy vấn SQL nghiệp vụ. |
| `npm run test:mail` | Kiểm tra `OTP_SECRET`, SMTP config và kết nối bằng `transporter.verify()`. Không gửi thư. |
| `node --check src/routes/auth-email.routes.js` | Ví dụ kiểm tra cú pháp một file JavaScript; lặp lại với file cần kiểm tra. Lệnh không chạy handler/SQL. |

Không có script tổng quát `npm test`, unit-test framework hoặc lệnh build frontend.

## Luồng xác minh email cần kiểm thử thủ công

Chỉ dùng mailbox và database phát triển với dữ liệu giả.

1. Gửi `POST /api/auth/email/send-code` với email mới; nhận phản hồi chung và kiểm tra email OTP thực sự tới mailbox.
2. Gửi lại ngay; endpoint phải trả 429 với `Retry-After`. Sau cooldown 60 giây, gửi mã mới và xác nhận mã cũ không còn hợp lệ.
3. Nhập mã sai tối đa 5 lần; các lần thử tiếp theo phải bị từ chối. Mã đúng có hạn 5 phút.
4. Xác minh mã đúng; API trả `verificationToken` có thời hạn 10 phút. Kiểm tra database lưu hash OTP/token, không phải giá trị gốc.
5. Đăng ký candidate và employer bằng token; employer cần gửi `companyName`. Xác nhận user/profile hoặc company được tạo và session được mở.
6. Dùng lại token, token hết hạn, thiếu token hoặc sửa token; đăng ký phải bị từ chối và không tạo user.
7. Yêu cầu mã cho email đã có tài khoản; phản hồi không tiết lộ tài khoản tồn tại và không gửi OTP mới.
8. Thử email sai định dạng, mã không đủ 6 chữ số, resend cooldown và rate limit 429.
9. Cố tình cấu hình SMTP sai trên môi trường test; endpoint không để mã hợp lệ kéo dài sau lỗi gửi.

## Kiểm thử nghiệp vụ khác

- Auth/session: register, login sai/đúng, session sau reload, idle timeout, logout, đổi mật khẩu.
- Authorization: truy cập hồ sơ/application/job/company thuộc role hoặc user khác.
- Jobs/applications: validate dữ liệu, job đóng/hết hạn, ứng tuyển trùng, đổi trạng thái.
- Interviews/messages: ngày giờ sai, ownership, gửi tin, đọc tin, cursor pagination.
- Database: tạo mới từ baseline, nâng cấp schema hiện có, chạy migration trên bản sao, kiểm tra khóa/index/default.
- Frontend: lỗi API, responsive, điều hướng role và thông báo trạng thái form.

Không dùng production data hoặc credentials thật trong test. Không coi kiểm tra SMTP `verify()` là xác nhận email OTP đã được gửi tới người nhận.
