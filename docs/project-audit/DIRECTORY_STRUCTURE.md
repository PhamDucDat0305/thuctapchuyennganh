# Cấu trúc project

```text
D:\DH52300430\
├── index.html, job-list.html, job-detail.html, auth.html, about.html, contact.html
├── candidate/                     # Trang ứng viên
├── employer/                      # Trang nhà tuyển dụng
├── css/                           # CSS chung và theo trang
├── js/                            # API client, auth, data layer và UI
├── ico/                           # Icon và web manifest
├── backend/
│   ├── package.json, package-lock.json, .env.example
│   ├── scripts/test-frontend-host.js
│   ├── sql/                        # 11 migration SQL Server
│   └── src/
│       ├── app.js, server.js
│       ├── config/                 # database, session, SMTP
│       ├── middleware/             # auth, role, rate limit, errors
│       ├── routes/                 # REST API, gồm auth-email.routes.js
│       ├── services/               # gửi email OTP
│       └── utils/                  # OTP, session helpers, async handler
└── docs/
    ├── PROJECT_FILE_GUIDE.md
    └── project-audit/              # hướng dẫn, API, kiến trúc, DB và kiểm thử
```

## Các file chính

| Đường dẫn | Chức năng |
|---|---|
| `js/api.js` | Gửi request JSON tới Express và kèm session cookie. |
| `js/auth.js` | Xác minh OTP, đăng ký, đăng nhập, đăng xuất và kiểm tra session phía giao diện. |
| `js/db.js` | Cung cấp `window.DB`, chuyển các thao tác giao diện thành request API. |
| `backend/src/server.js` | Nạp cấu hình môi trường, kết nối database/session store và mở HTTP server. |
| `backend/src/app.js` | Cấu hình Express, static frontend, middleware và API routes. |
| `backend/src/config/database.js` | Cấu hình SQL Server và pool dùng chung. |
| `backend/src/config/session.js` | Session cookie và store SQL Server. |
| `backend/src/config/mail.js` | Cấu hình Nodemailer/SMTP từ biến môi trường. |
| `backend/src/routes/auth-email.routes.js` | Gửi OTP và phát verification token dùng một lần. |
| `backend/src/services/emailService.js` | Tạo nội dung và gửi email OTP. |
| `backend/src/utils/otp.js` | Sinh OTP và kiểm tra HMAC an toàn. |
| `backend/src/test-mail.js` | Kiểm tra cấu hình và kết nối SMTP; không gửi email. |
| `backend/sql/001`–`011` | Migrations bổ sung. Không có migration tạo `dbo.email_verifications` hoặc toàn bộ bảng lõi. |

Xem [PROJECT_FILE_GUIDE.md](../PROJECT_FILE_GUIDE.md) để biết các module gọi nhau ra sao và vai trò từng file backend/JavaScript.
