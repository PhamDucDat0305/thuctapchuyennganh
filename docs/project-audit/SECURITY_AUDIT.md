# Security audit

## Phạm vi và giới hạn

Đây là static review source/config. Không quét lỗ hổng bằng scanner, không chạy penetration test, không truy cập DB, không đọc `backend/.env`, không kiểm tra Firebase security rules hoặc môi trường production. Không kết luận hệ thống an toàn chỉ vì không thấy một pattern.

## Authentication và session

- Password hash/verify bằng Argon2 trong `auth.routes.js`; có dummy hash để giảm chênh lệch timing khi email không tồn tại.
- Session ID được regenerate khi login/register; session lưu qua `connect-mssql-v2`; cookie `httpOnly`, `sameSite=lax`, `secure` khi `NODE_ENV=production`; TTL 7 ngày.
- Middleware đối chiếu user và trạng thái active từ DB mỗi request.
- Đã thêm rate limit in-memory cho login/register, ứng tuyển, gửi tin nhắn/lời mời và job views; chưa có shared store, lockout theo tài khoản, MFA challenge, password reset, email verification hoặc lịch sử đăng nhập thật.
- Đổi password không chủ động hủy các session còn lại của user.
- Logout route không yêu cầu authenticate; hủy session nếu có và clear cookie, phù hợp endpoint logout idempotent.

## Authorization/BOLA/IDOR

- Nhiều route kiểm tra role và ownership bằng `candidate_id`/`recruiter_id` trong SQL.
- `GET /api/users/:id` nay giới hạn quyền theo self/admin hoặc employer và candidate discoverability/quan hệ ứng tuyển; cần xác minh role matrix trong SQL Server staging (ISSUE-001).
- Candidate discovery list và chi tiết đều cần đảm bảo `search_status=1` với employer chưa có quan hệ.
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
- Firebase client config, SDK imports và nhánh auto migrate localStorage đã được gỡ. Cần kiểm tra browser Network để xác nhận không có request CDN/Firebase còn sót.
- Log error handler ghi toàn bộ error object và URL; hiện chưa thấy route dùng query secret, nhưng nên scrub query/PII khi mở rộng logging.
- Không thấy file upload/storage, do đó chưa có validation/access control cho file. CV đang là text.

## Abuse và availability

- Rate limits đã che một phần auth/message/invite/job-view abuse; store chỉ nằm trong RAM một process và không thay thế abuse controls dùng chung khi scale ngang.
- Public job list và nhiều user-specific list không pagination; dễ gây tải lớn.
- Conversations aggregate qua lịch sử tin nhắn trước khi trả latest/unread.
- `express.json` giới hạn 1 MB, message limit 2.000 ký tự; các mức này là kiểm soát hữu ích nhưng không thay thế quota/rate limiting.

## Ưu tiên khắc phục

1. Xoay DB credential/session secret đã chia sẻ.
2. Xác minh policy profile visibility và kiểm thử BOLA theo role.
3. Kiểm tra browser Network sau khi gỡ Firebase; localStorage legacy được giữ lại.
4. Giữ UI 2FA ở trạng thái chưa khả dụng cho tới khi triển khai MFA thật.
5. Chuyển rate limit sang shared store khi scale; bổ sung security headers, CSRF strategy và production proxy/cookie config.
6. Bổ sung test bảo mật cho ownership, private profiles, authentication/session và dữ liệu đầu vào.
