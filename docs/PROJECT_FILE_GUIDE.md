# Hướng dẫn Backend và JavaScript của JobViệt

## Phạm vi

Tài liệu này tập trung vào mã backend trong `backend/` và JavaScript phía trình duyệt trong `js/`. HTML, CSS, icon và tài liệu khác được chủ ý lược bỏ để tập trung vào luồng xử lý dữ liệu và API. Các file được liệt kê là những file backend/JS đang được Git theo dõi; không bao gồm `node_modules/`, `.git/` hay file `.env` chứa thông tin bí mật.

Mỗi mục nêu chức năng và nội dung chính của file. Đây là bản đồ source code, không phải bản sao đầy đủ từng dòng mã.

## Kiến trúc trong một request

1. Trang giao diện gọi các hàm của `js/db.js` hoặc `js/auth.js`.
2. Những module này dùng `js/api.js` để gửi HTTP request tới `/api`, kèm cookie session.
3. `backend/src/app.js` nhận request và chuyển tới route tương ứng trong `backend/src/routes/`.
4. Middleware xác thực session và vai trò trước khi route đọc/ghi dữ liệu bằng pool SQL Server.
5. Route trả JSON; frontend cập nhật giao diện hoặc hiển thị lỗi.

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

## Các luồng quan trọng

### Đăng nhập

`js/auth.js` gọi API đăng nhập; `backend/src/routes/auth.routes.js` kiểm tra thông tin và tạo session. Session store trong SQL Server lưu phiên; `authenticate.js` xác nhận session cho request cần đăng nhập.

### Chức năng dữ liệu

`js/db.js` cung cấp các hàm dữ liệu dùng chung cho trang giao diện. Mỗi hàm gọi API tương ứng; route backend kiểm tra dữ liệu/quyền và thực hiện SQL qua pool từ `config/database.js`.

### Schema

Các thay đổi cấu trúc database được ghi trong `backend/sql/`. Đây là migration thủ công; trước khi áp dụng cần kiểm tra schema thực tế vì migration có thể phụ thuộc trạng thái bảng/cột hiện hữu.

## Giới hạn tài liệu

Mô tả chức năng dựa trên source hiện tại. Endpoint liệt kê là đường dẫn tương đối của router; `app.js` gắn router vào prefix `/api`. Payload, mã trạng thái và quyền chi tiết cần đối chiếu với logic trong từng route.
