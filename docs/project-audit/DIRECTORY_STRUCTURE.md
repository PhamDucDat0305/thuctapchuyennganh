# Cây thư mục project

```text
D:\DH52300430\
├── index.html, job-list.html, job-detail.html, auth.html
├── about.html, contact.html, LabThucHanh.html
├── candidate/                    # Trang tài khoản ứng viên
├── employer/                     # Trang tài khoản nhà tuyển dụng
├── css/                           # CSS chung và theo trang
├── js/                            # API client, auth, data layer, UI
├── ico/                           # Icon/manifest tĩnh
├── backend/
│   ├── package.json, package-lock.json, .env.example
│   ├── sql/                       # SQL migrations 001–011
│   └── src/
│       ├── app.js, server.js
│       ├── config/                # Database pool, session
│       ├── middleware/            # Auth, roles, errors
│       ├── routes/                # REST API
│       └── utils/                 # async/session helpers
└── docs/project-audit/            # 12 tài liệu audit được tạo
```

## Thành phần quan trọng

| Đường dẫn | Vai trò/phụ thuộc | Tầm quan trọng | Sinh tự động? |
|---|---|---:|---|
| `index.html`, `job-list.html`, `job-detail.html` | Trang công khai; gọi `js/db.js`/API và render job | Cao | Không |
| `auth.html` | Đăng nhập/đăng ký qua `window.Auth` | Cao | Không |
| `candidate/*.html` | Dashboard, hồ sơ, ứng tuyển, việc lưu, message, interview, invite | Cao | Không |
| `employer/*.html` | Dashboard, quản lý việc, ứng viên, company, message, interview | Cao | Không |
| `css/styles.css`, `css/navbar.css`, `css/pages/*.css` | Styles toàn site và theo module | Trung bình | Không |
| `js/api.js` | Fetch JSON tới API trên port 3000; gửi cookie credentials | Cao | Không |
| `js/auth.js` | Login/register/logout, cache user, kiểm tra `/api/me` | Cao | Không |
| `js/db.js` | Adapter `window.DB`, gọi Express API | Cao | Không |
| `js/app.js`, `js/navbar.js`, `js/notifications.js` | Navigation, sidebar, badge, UI/toast/chat | Cao | Không |
| `backend/src/server.js` | Entry point; connect DB, listen, shutdown | Cao | Không |
| `backend/src/app.js` | Express middleware, CORS, JSON, session, route mounting | Cao | Không |
| `backend/src/config/database.js` | Cấu hình và singleton pool SQL Server | Cao | Không |
| `backend/src/config/session.js` | Session cookie, SQL Server store | Cao | Không |
| `backend/src/middleware/*` | Xác thực, role, not-found, lỗi | Cao | Không |
| `backend/src/routes/*` | Nghiệp vụ API và truy vấn SQL | Cao | Không |
| `backend/src/utils/*` | Promise adapters | Thấp | Không |
| `backend/sql/001`–`011` | Bảng mở rộng/migration theo bước; phụ thuộc schema lõi không có trong repo | Cao | Không |
| `backend/.env.example` | Tên biến và placeholder cấu hình | Cao | Không |
| `backend/.env` | File local hiện diện/được ignore; không đọc giá trị khi audit | Nhạy cảm | Không |
| `backend/package-lock.json` | Khóa dependency backend | Cao | Tự sinh bởi npm |
| `backend/node_modules/` | Thư viện cài local, bị bỏ qua khi liệt kê source | Không đưa vào kiểm kê | Sinh tự động |
| `.gitignore` | Bỏ qua `.env`, `node_modules`, log | Cao | Không |
| `.vscode/` | Cấu hình editor; không phải cấu hình build | Thấp | Không |
| `LabThucHanh.html` | Trang lab ở root | Thấp | Không |

## File SQL

`001_create_sessions.sql`; `002_create_applications.sql`; `003_add_application_cv_text.sql`; `004_create_interviews.sql`; `005_upgrade_interviews_columns.sql`; `006_add_profile_fields.sql`; `007_create_saved_jobs.sql`; `008_create_messages.sql`; `009_limit_message_content.sql`; `010_create_invites.sql`; `011_create_profile_views.sql`.

## Tài liệu hiện có và Git

Trước audit không tìm thấy README/Markdown tài liệu project; `docs/project-audit/` được tạo mới. `git status` cho thấy working tree có nhiều thay đổi chưa commit, gồm 515 file bị xóa (nhiều file thuộc `LabThucHanh/`), 43 file sửa và 4 mục untracked tại thời điểm kiểm tra. Đây là trạng thái sẵn có; audit không chỉnh sửa hay phục hồi các file đó.
