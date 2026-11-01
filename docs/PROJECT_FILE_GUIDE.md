# Hướng dẫn các file trong project JobViệt

## Phạm vi

Tài liệu này mô tả từng file đang được Git theo dõi tại thời điểm tạo: mục đích, phần nội dung/chức năng chính và một số endpoint/đối tượng SQL được đọc trực tiếp từ mã nguồn. Các file được tạo tự động trong `node_modules/`, metadata lịch sử trong `.git/`, file `.env` thực chứa secret và file chưa được Git theo dõi không nằm trong danh sách. File hình được ghi vai trò/tên tài nguyên vì không chứa mã nguồn văn bản.

## Cách đọc

- **File**: đường dẫn tương đối từ thư mục gốc project.
- **Nội dung/chức năng**: trách nhiệm chính dựa trên mã hiện có; đây là mô tả, không phải bản sao toàn bộ source code.
- Frontend là HTML/CSS/JS thuần; backend là Express + SQL Server; migrations trong `backend/sql` được chạy thủ công theo đúng trạng thái database.

## (thư mục gốc)

### `.gitignore`

Quy tắc loại file bí mật, dependency, output hoặc file môi trường khỏi Git.

### `LabThucHanh.html`

Trang lab/thực hành giao diện, dùng các stylesheet riêng cho lab.

### `about.html`

Trang giới thiệu website/dịch vụ JobViệt.

### `auth.html`

Giao diện đăng nhập/đăng ký; form được xử lý bởi js/auth.js và gọi API xác thực.

### `contact.html`

Trang thông tin/liên hệ JobViệt.

### `index.html`

Trang chủ công khai: giới thiệu JobViệt, điều hướng và các khối nội dung trang chủ.

### `job-detail.html`

Chi tiết một tin tuyển dụng, hiển thị thông tin và các thao tác lưu/ứng tuyển.

### `job-list.html`

Danh sách/tìm kiếm/lọc tin tuyển dụng; dữ liệu tải từ API việc làm.

## .vscode

### `.vscode/settings.json`

Cài đặt editor VS Code dùng chung trong project.

## backend

### `backend/.env.example`

Mẫu tên biến môi trường backend; không chứa secret thật.

### `backend/package-lock.json`

Khóa chính xác phiên bản dependency để npm cài đặt lặp lại ổn định.

### `backend/package.json`

Metadata backend, scripts chạy/test và danh sách package phụ thuộc.

## backend/scripts

### `backend/scripts/test-frontend-host.js`

Bài kiểm tra HTTP cho các trang/tài nguyên frontend, health endpoint và giới hạn truy cập file nội bộ.

## backend/sql

### `backend/sql/001_create_sessions.sql`

Tạo bảng dbo.sessions và index hết hạn để express-session lưu phiên đăng nhập. Đối tượng bảng được nhắc tới: dbo.sessions.

### `backend/sql/002_create_applications.sql`

Tạo dbo.applications cùng khóa/quan hệ và index phục vụ tra cứu đơn ứng tuyển. Đối tượng bảng được nhắc tới: dbo.applications, dbo.jobs, dbo.users.

### `backend/sql/003_add_application_cv_text.sql`

Bổ sung cột cv_text cho nội dung CV chụp tại thời điểm ứng tuyển. Đối tượng bảng được nhắc tới: dbo.applications.

### `backend/sql/004_create_interviews.sql`

Tạo bảng dbo.interviews cho lịch phỏng vấn liên kết với đơn ứng tuyển. Đối tượng bảng được nhắc tới: dbo.interviews, dbo.applications.

### `backend/sql/005_upgrade_interviews_columns.sql`

Nâng cấp bảng interviews với ngày/giờ, thời gian, loại, ghi chú và timestamp cần cho API. Đối tượng bảng được nhắc tới: dbo.interviews.

### `backend/sql/006_add_profile_fields.sql`

Thêm cờ hồ sơ cho users; tạo/bổ sung candidate_profiles và thêm trường hồ sơ công ty. Đối tượng bảng được nhắc tới: dbo.users, dbo.candidate_profiles, dbo.companies.

### `backend/sql/007_create_saved_jobs.sql`

Tạo dbo.saved_jobs để lưu quan hệ ứng viên–tin đã lưu và index liên quan. Đối tượng bảng được nhắc tới: dbo.saved_jobs, dbo.users, dbo.jobs.

### `backend/sql/008_create_messages.sql`

Tạo cấu trúc hội thoại/tin nhắn và các chỉ mục phục vụ truy vấn. Đối tượng bảng được nhắc tới: dbo.messages, dbo.users.

### `backend/sql/009_limit_message_content.sql`

Điều chỉnh giới hạn/kích thước cột nội dung tin nhắn tương thích SQL Server. Đối tượng bảng được nhắc tới: dbo.messages.

### `backend/sql/010_create_invites.sql`

Tạo bảng lời mời nhà tuyển dụng gửi ứng viên và index cần thiết. Đối tượng bảng được nhắc tới: dbo.invites, dbo.users, dbo.jobs.

### `backend/sql/011_create_profile_views.sql`

Tạo bảng ghi nhận lượt xem hồ sơ giữa nhà tuyển dụng và ứng viên. Đối tượng bảng được nhắc tới: dbo.profile_views, dbo.users.

## backend/src

### `backend/src/app.js`

Tạo Express app, cấu hình CORS, phân phối trang/tài nguyên frontend allowlist, gắn JSON/session, đăng ký các nhóm API và middleware lỗi.

### `backend/src/server.js`

Điểm khởi chạy backend: nạp .env, mở SQL pool/session store, lắng nghe cổng HTTP và đóng tài nguyên khi tắt.

## backend/src/config

### `backend/src/config/database.js`

Đọc cấu hình SQL Server từ biến môi trường, tạo pool dùng chung, kiểm tra kết nối và đóng pool.

### `backend/src/config/session.js`

Cấu hình express-session và MSSQL session store; kết nối/đóng bảng phiên SQL Server.

## backend/src/middleware

### `backend/src/middleware/authenticate.js`

Đọc session và xác minh người dùng đã đăng nhập trước khi cho phép xử lý route.

### `backend/src/middleware/errorHandler.js`

Trả JSON 404 và xử lý lỗi tập trung; tránh gửi stack trace nội bộ ra client.

### `backend/src/middleware/rateLimit.js`

Giới hạn tần suất thao tác theo IP/người dùng để giảm spam và lạm dụng endpoint.

### `backend/src/middleware/requireRole.js`

Middleware giới hạn quyền theo vai trò như candidate/employer/admin.

## backend/src/routes

### `backend/src/routes/applications.routes.js`

API ứng tuyển: ứng viên tạo/xem đơn; nhà tuyển dụng xem đơn thuộc tin của mình và cập nhật trạng thái. Endpoint khai báo: GET /, GET /check/:jobId, GET /job/:jobId, POST /, GET /:id, PATCH /:id, DELETE /:id.

### `backend/src/routes/auth.routes.js`

API đăng ký, đăng nhập và đăng xuất; băm/kiểm tra mật khẩu, tạo/hủy session. Endpoint khai báo: POST /register, POST /login, POST /logout.

### `backend/src/routes/employer-company.routes.js`

API nhà tuyển dụng đọc/cập nhật hồ sơ công ty gắn với tài khoản. Endpoint khai báo: GET /, POST /, PUT /.

### `backend/src/routes/employer-jobs.routes.js`

API nhà tuyển dụng tạo, liệt kê, cập nhật và quản lý tin tuyển dụng của chính họ. Endpoint khai báo: GET /, GET /:id, POST /, PATCH /:id, PATCH /:id/close.

### `backend/src/routes/health.routes.js`

API kiểm tra backend sống và kiểm tra kết nối database. Endpoint khai báo: GET /, GET /db.

### `backend/src/routes/interviews.routes.js`

API tạo/xem/cập nhật lịch phỏng vấn gắn với đơn ứng tuyển và quyền hai bên. Endpoint khai báo: GET /, GET /application/:applicationId, POST /.

### `backend/src/routes/invites.routes.js`

API nhà tuyển dụng gửi lời mời ứng viên; ứng viên xem và phản hồi lời mời. Endpoint khai báo: GET /, POST /, PATCH /:id/status.

### `backend/src/routes/jobs.routes.js`

API công khai danh sách/chi tiết tin tuyển dụng và ghi nhận lượt xem tin. Endpoint khai báo: GET /, POST /:id/view, GET /:id.

### `backend/src/routes/me.routes.js`

API thông tin tài khoản hiện tại, cập nhật hồ sơ và đổi mật khẩu. Endpoint khai báo: GET /, PATCH /profile, POST /password.

### `backend/src/routes/messages.routes.js`

API hội thoại, đọc/gửi tin nhắn, đánh dấu đã đọc và truy vấn tin của hai người. Endpoint khai báo: GET /conversations, GET /conversation/:contactId, POST /, PATCH /read/:contactId.

### `backend/src/routes/profile-views.routes.js`

API ứng viên xem lịch sử lượt xem hồ sơ; nhà tuyển dụng ghi nhận lượt xem. Endpoint khai báo: GET /, POST /.

### `backend/src/routes/saved-jobs.routes.js`

API lấy danh sách, kiểm tra, lưu/bỏ lưu tin tuyển dụng. Endpoint khai báo: GET /, GET /check/:jobId, POST /:jobId/toggle, DELETE /:jobId.

### `backend/src/routes/stats.routes.js`

API trả số liệu dashboard/thống kê phù hợp với người dùng hiện tại. Endpoint khai báo: GET /.

### `backend/src/routes/users.routes.js`

API tra cứu danh sách/hồ sơ ứng viên theo quyền được cấp. Endpoint khai báo: GET /candidates, GET /:id.

## backend/src/utils

### `backend/src/utils/asyncHandler.js`

Bọc async route handler để chuyển Promise rejection tới middleware lỗi Express.

### `backend/src/utils/sessionHelpers.js`

Promise helper cho regenerate/save/destroy session; dùng trong luồng xác thực.

## candidate

### `candidate/accepted-jobs.html`

Danh sách ứng tuyển được nhà tuyển dụng chấp nhận/trúng tuyển.

### `candidate/account.html`

Thông tin tài khoản cá nhân và form cập nhật hồ sơ/tài khoản.

### `candidate/apply.html`

Trang xác nhận/nộp ứng tuyển cho một tin tuyển dụng.

### `candidate/cover-letter.html`

Trang mẫu/nội dung thư xin việc.

### `candidate/dashboard.html`

Bảng tổng quan ứng viên, hiển thị số liệu và lối tắt tới các chức năng ứng viên.

### `candidate/employer-invites.html`

Danh sách lời mời phỏng vấn/trao đổi từ nhà tuyển dụng.

### `candidate/interviews.html`

Danh sách và chi tiết lịch phỏng vấn.

### `candidate/messages.html`

Hộp thư và giao diện hội thoại.

### `candidate/my-applications.html`

Danh sách việc đã ứng tuyển và trạng thái.

### `candidate/my-cv.html`

Quản lý/xem CV của ứng viên.

### `candidate/profile-views.html`

Lịch sử nhà tuyển dụng đã xem hồ sơ ứng viên.

### `candidate/saved-jobs.html`

Danh sách tin tuyển dụng đã lưu.

### `candidate/security.html`

Cài đặt bảo mật tài khoản.

## css

### `css/navbar.css`

Kiểu thanh điều hướng, menu và responsive navigation.

### `css/styles.css`

Style nền dùng chung: biến thiết kế, layout, nút, form, card và component tái sử dụng.

## css/pages

### `css/pages/admin.css`

Quy tắc giao diện theo trang/nhóm admin; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/auth.css`

Quy tắc giao diện theo trang/nhóm auth; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/candidate.css`

Quy tắc giao diện theo trang/nhóm candidate; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/dashboard.css`

Quy tắc giao diện theo trang/nhóm dashboard; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/employer.css`

Quy tắc giao diện theo trang/nhóm employer; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/home.css`

Quy tắc giao diện theo trang/nhóm home; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/job.css`

Quy tắc giao diện theo trang/nhóm job; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/lab.css`

Quy tắc giao diện theo trang/nhóm lab; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/messages.css`

Quy tắc giao diện theo trang/nhóm messages; định nghĩa bố cục, màu sắc và trạng thái component.

### `css/pages/static.css`

Quy tắc giao diện theo trang/nhóm static; định nghĩa bố cục, màu sắc và trạng thái component.

## docs/project-audit

### `docs/project-audit/API_DOCUMENTATION.md`

Danh mục endpoint, phương thức, quyền và ví dụ gọi API. Các mục: Health, auth, me, public; Employer jobs, company, users; Applications và interview; Saved jobs, messages, invites, profile views; Ví dụ dữ liệu giả; Lỗi chung.

### `docs/project-audit/ARCHITECTURE.md`

Mô tả phân lớp, request/data flow, xác thực, phân quyền và các luồng nghiệp vụ. Các mục: Phân lớp; Request và database; Authentication/session; Phân quyền và ownership; Các luồng nghiệp vụ; Ứng tuyển.

### `docs/project-audit/BUGS_AND_ISSUES.md`

Ghi nhận lỗi/rủi ro kỹ thuật phát hiện trong đợt audit. Các mục: Các vấn đề không kết luận là lỗi.

### `docs/project-audit/CHECKLIST_TEST_CHUC_NANG.md`

Danh sách bước kiểm thử thủ công các luồng chính trên UI/API/database. Các mục: 1. Chuẩn bị môi trường; 2. Khách và xác thực; 3. Hồ sơ và quyền riêng tư ứng viên; 4. Tin tuyển dụng và lượt xem; 5. Ứng tuyển và phỏng vấn; 6. Công ty, việc đã lưu, lời mời và lượt xem hồ sơ.

### `docs/project-audit/DATABASE.md`

Tài liệu schema SQL Server, migration, quan hệ bảng và lưu ý kiểm chứng. Các mục: A. Database và schema lifecycle; B. Các bảng; Bảng được tạo bởi scripts; Bảng lõi được tham chiếu nhưng thiếu DDL; C. ERD (quan hệ được xác nhận trong migration/code); D. Truy vấn và nghiệp vụ.

### `docs/project-audit/DIRECTORY_STRUCTURE.md`

Sơ đồ thư mục và giải thích các nhóm file chính. Các mục: Thành phần quan trọng; File SQL; Tài liệu hiện có và Git.

### `docs/project-audit/FEATURES.md`

Danh sách tính năng người dùng và mức độ hoàn thiện đã rà soát. Các mục: Tổng kết mức hoàn thiện.

### `docs/project-audit/IMPROVEMENT_ROADMAP.md`

Lộ trình cải tiến được sắp theo mức ưu tiên. Các mục: P0 — Làm trước khi đưa lên môi trường dùng thật; P1 — Tính đúng và giảm rủi ro nghiệp vụ; P2 — Khả năng bảo trì và hiệu năng; P3 — Mở rộng có căn cứ.

### `docs/project-audit/README.md`

Tổng quan JobViệt, vai trò, chức năng, công nghệ và trạng thái audit. Các mục: Mục đích; Người dùng và vai trò; Chức năng chính đã tìm thấy; Công nghệ và kiến trúc; Cấu trúc project con; Điều kiện chạy (theo cấu hình).

### `docs/project-audit/RUN_AND_DEPLOY.md`

Yêu cầu môi trường, cấu hình .env, database, chạy local và triển khai. Các mục: Điều kiện; Cài dependency; Cấu hình môi trường; Database; Chạy local; Build/test/deploy.

### `docs/project-audit/SECURITY_AUDIT.md`

Đánh giá xác thực, phân quyền, SQL, XSS, secrets và rủi ro an ninh. Các mục: Phạm vi và giới hạn; Authentication và session; Authorization/BOLA/IDOR; SQL injection và validation; XSS và browser security; Secrets, Firebase và dữ liệu.

### `docs/project-audit/TECH_STACK.md`

Công nghệ, runtime và dependency của frontend/backend. Các mục: Công nghệ phát hiện; Dependency backend; Build/package tools; Cài dependency; Chưa xác định.

### `docs/project-audit/TESTING.md`

Tổng hợp test có sẵn, test đã chạy và phần cần xác minh/bổ sung. Các mục: Test suite trong repository; Lệnh thực sự chạy trong audit; Chưa chạy/chưa xác minh; Test nên bổ sung; Backend unit/integration; Frontend.

## employer

### `employer/accepted-candidates.html`

Các ứng viên đã được chấp nhận/trúng tuyển vào tin của nhà tuyển dụng.

### `employer/account.html`

Thông tin tài khoản nhà tuyển dụng và cập nhật thông tin cá nhân.

### `employer/applicants.html`

Tìm kiếm/lọc ứng viên trên nền tảng.

### `employer/applied-candidates.html`

Danh sách ứng viên đã nộp đơn vào các tin.

### `employer/candidate-profile.html`

Hồ sơ chi tiết của ứng viên được nhà tuyển dụng xem.

### `employer/company-profile.html`

Thông tin hồ sơ công ty công khai.

### `employer/dashboard.html`

Tổng quan hoạt động tuyển dụng và số liệu chính.

### `employer/edit-company.html`

Biểu mẫu chỉnh sửa hồ sơ công ty.

### `employer/edit-job.html`

Biểu mẫu sửa tin tuyển dụng hiện có.

### `employer/interviews.html`

Quản lý lịch phỏng vấn với ứng viên.

### `employer/job-applicants.html`

Danh sách ứng viên của một tin tuyển dụng cụ thể.

### `employer/messages.html`

Hộp thư và hội thoại của nhà tuyển dụng.

### `employer/my-jobs.html`

Danh sách/quản lý các tin do nhà tuyển dụng đăng.

### `employer/password.html`

Đổi mật khẩu tài khoản nhà tuyển dụng.

### `employer/post-job.html`

Biểu mẫu tạo tin tuyển dụng mới.

### `employer/saved-candidates.html`

Danh sách ứng viên nhà tuyển dụng đã lưu.

### `employer/security.html`

Trang chức năng dành cho nhà tuyển dụng.

### `employer/stats-performance.html`

Thống kê hiệu quả tuyển dụng.

### `employer/stats-views.html`

Thống kê lượt xem tin tuyển dụng.

## ico

### `ico/android-icon-144x144.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/android-icon-192x192.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/android-icon-36x36.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/android-icon-48x48.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/android-icon-72x72.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/android-icon-96x96.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-114x114.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-120x120.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-144x144.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-152x152.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-180x180.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-57x57.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-60x60.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-72x72.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-76x76.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon-precomposed.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/apple-icon.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/browserconfig.xml`

Cấu hình/icon metadata dành cho trình duyệt hoặc Windows.

### `ico/favicon-16x16.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/favicon-32x32.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/favicon-96x96.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/favicon.ico`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/manifest.json`

Web app manifest: tên ứng dụng, icon và cách trình duyệt cài shortcut.

### `ico/ms-icon-144x144.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/ms-icon-150x150.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/ms-icon-310x310.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

### `ico/ms-icon-70x70.png`

Ảnh icon/favicon dành cho kích thước hoặc nền tảng cụ thể.

## js

### `js/api.js`

HTTP client dùng chung: xác định API base URL, gửi fetch kèm cookie session, xử lý JSON và lỗi API. Hàm chính tìm thấy: apiRequest.

### `js/app.js`

Logic giao diện dùng chung cho dashboard: điều hướng theo vai trò, render tiện ích, danh sách, thông báo/trạng thái. Hàm chính tìm thấy: escapeChatHtml, renderBadge, link, start, msgUrl.

### `js/auth.js`

Kiểm tra trạng thái đăng nhập, đăng nhập/đăng ký/đăng xuất, bảo vệ trang và đồng bộ user hiện tại.

### `js/db.js`

Lớp dữ liệu phía trình duyệt; gọi các endpoint backend và cung cấp các hàm nghiệp vụ cho trang HTML. Hàm chính tìm thấy: refresh.

### `js/navbar.js`

Tạo thanh điều hướng, menu tài khoản theo vai trò và xử lý sự kiện menu. Hàm chính tìm thấy: getUser, getInitials, resolveHref, buildDropdownSections, buildNavbarHTML, buildLoginButtons, buildProfileHTML, setupEvents.

### `js/notifications.js`

Hiển thị toast/thông báo tạm thời cho thao tác thành công hoặc lỗi.

## Luồng tổng thể

1. Trình duyệt mở file HTML; HTML nạp style từ `css/` và logic từ `js/`.
2. `js/api.js` gửi request tới `/api`; `backend/src/app.js` định tuyến request tới module `backend/src/routes/`.
3. Route xác thực qua session/middleware, truy vấn SQL Server bằng pool trong `config/database.js`, rồi trả JSON.
4. Các thay đổi schema nằm trong migration `backend/sql/`; cần đối chiếu cấu trúc database thực tế trước khi chạy migration.

## Lưu ý

File này mô tả chức năng cấp file, không chép lại toàn bộ từng dòng code. Khi mã nguồn thay đổi, cần cập nhật mô tả để khớp phiên bản mới.
