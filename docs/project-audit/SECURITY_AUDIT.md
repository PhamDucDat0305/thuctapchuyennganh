# Security audit

## Phạm vi và giới hạn

Đây là static review source/config. Không quét lỗ hổng bằng scanner, không chạy penetration test, không truy cập DB, không đọc `backend/.env`, không kiểm tra Firebase security rules hoặc môi trường production. Không kết luận hệ thống an toàn chỉ vì không thấy một pattern.

## Authentication và session

- Password hash/verify bằng Argon2 trong `auth.routes.js`; có dummy hash để giảm chênh lệch timing khi email không tồn tại.
- Session ID được regenerate khi login/register; session lưu qua `connect-mssql-v2`; cookie `httpOnly`, `sameSite=lax`, `secure` khi `NODE_ENV=production`; TTL 7 ngày.
- Middleware đối chiếu user và trạng thái active từ DB mỗi request.
- Không thấy rate limiter, lockout/backoff, MFA challenge, password reset, email verification hoặc đăng nhập lịch sử.
- Đổi password không chủ động hủy các session còn lại của user.
- Logout route không yêu cầu authenticate; hủy session nếu có và clear cookie, phù hợp endpoint logout idempotent.

## Authorization/BOLA/IDOR

- Nhiều route kiểm tra role và ownership bằng `candidate_id`/`recruiter_id` trong SQL.
- **Lỗ hổng privacy cần ưu tiên:** `GET /api/users/:id` không kiểm tra `search_status` và trả thông tin profile cơ bản cho user đăng nhập bất kỳ. Đánh giá chi tiết ISSUE-001.
- Candidate discovery list lọc `search_status=1`, nhưng endpoint detail có thể bỏ qua chính sách đó.
- Message API cho phép gửi tới mọi account active candidate/employer, không yêu cầu đã có application/invite/relationship. Có thể là thiết kế sản phẩm, nhưng tăng spam/abuse; xác nhận policy.
- Employer mời candidate cũng kiểm tra active role nhưng không yêu cầu search_status=1.

## SQL injection và validation

- Các giá trị input SQL quan sát được bind bằng `request.input`.
- Câu SQL động trong update dùng danh sách field/column constant/whitelist; chưa thấy user-controlled identifier được nội suy.
- Validation giới hạn nhiều text/ID/date/status; JSON body limit 1 MB.
- Không có thư viện schema validator tập trung; validation lặp trong routes và chưa thấy giới hạn độ dài/query param toàn cục.

## XSS và browser security

- `job-list.html`, `job-detail.html`, nhiều trang edit/messages có helper escape output. Chưa rà từng template đầy đủ hoặc chạy DOM XSS scan; trạng thái là chưa xác minh toàn diện.
- Không thấy `helmet`, CSP, HSTS hoặc cấu hình security headers trong Express.
- CORS dùng allowlist `FRONTEND_ORIGINS`, không dùng wildcard, credential true. Mặc định có local origins.
- Cookie session + CORS là mô hình cần xem xét CSRF. Không thấy CSRF token; `sameSite=lax` giảm một số cross-site request nhưng cần kiểm tra theo domain/HTTPS triển khai thực tế.
- Với production phía sau reverse proxy, `trust proxy` chưa cấu hình trong app; cần kiểm tra `secure` cookie có được set đúng khi TLS kết thúc ở proxy.

## Secrets, Firebase và dữ liệu

- `backend/.env` tồn tại nhưng bị ignore; audit không đọc giá trị. `.env.example` dùng placeholders.
- Trong trao đổi trước, người dùng đã dán giá trị có dạng credentials thật cho DB và `SESSION_SECRET`; tài liệu này không lặp lại giá trị. Coi các giá trị đã chia sẻ là bị lộ và xoay vòng trước khi triển khai/chia sẻ thêm.
- Firebase client config vẫn có trong source (Firebase config phía client không phải server secret), và client có nhánh auto migrate localStorage lên Firestore rồi xóa key cũ. Kiểm tra Firebase rules và ngừng nhánh ngoài dự định; không gửi dữ liệu thật trong khi xác minh.
- Log error handler ghi toàn bộ error object và URL; hiện chưa thấy route dùng query secret, nhưng nên scrub query/PII khi mở rộng logging.
- Không thấy file upload/storage, do đó chưa có validation/access control cho file. CV đang là text.

## Abuse và availability

- Không thấy rate limiting trên auth/message/invite/job-view; có thể bị brute force, spam hoặc làm phình view count.
- Public job list và nhiều user-specific list không pagination; dễ gây tải lớn.
- Conversations aggregate qua lịch sử tin nhắn trước khi trả latest/unread.
- `express.json` giới hạn 1 MB, message limit 2.000 ký tự; các mức này là kiểm soát hữu ích nhưng không thay thế quota/rate limiting.

## Ưu tiên khắc phục

1. Xoay DB credential/session secret đã chia sẻ.
2. Sửa policy profile visibility và kiểm thử BOLA theo role.
3. Gỡ Firebase auto-migration/client imports hoặc xác nhận chủ đích, bảo vệ local data.
4. Thay UI 2FA bằng flow thật hoặc bỏ nhãn “đã bật”.
5. Thêm rate limits, secure headers, CSRF strategy và production proxy/cookie config.
6. Bổ sung test bảo mật cho ownership, private profiles, authentication/session và dữ liệu đầu vào.
