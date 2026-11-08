# Hướng dẫn chức năng hiện có của JobViệt

Tài liệu này mô tả các luồng đang có trong source hiện tại, chia theo vai trò và chỉ rõ giao diện gọi backend, dữ liệu được lưu ở đâu, quyền nào được kiểm tra. Một trang HTML có nút bấm chưa chắc đã có xử lý thật; phần cuối phân biệt chức năng chạy với dữ liệu SQL và phần giao diện mẫu.

## 1. Tổng quan cách project hoạt động

JobViệt hiện gồm frontend HTML/CSS/JavaScript, backend Node.js/Express và SQL Server.

```text
Trang HTML
   ↓ gọi window.DB
js/db.js (adapter nghiệp vụ)
   ↓ gọi apiRequest
js/api.js (fetch và gửi session cookie)
   ↓
backend/src/app.js (middleware, route)
   ↓ authenticate / requireRole / kiểm tra quyền sở hữu
backend/src/routes/*.js
   ↓ mssql pool dùng chung
SQL Server (dbo.*)
```

- `js/app.js` dựng sidebar, menu, dashboard shell, badge thông báo và một số chức năng giao diện dùng chung.
- `js/navbar.js` dựng thanh điều hướng chính và menu theo tài khoản.
- `js/db.js` cung cấp các hàm frontend như `getJobs()`, `createApplication()`, `scheduleInterview()`; đây là lớp gọi API, không phải nơi lưu database.
- `backend/src/config/database.js` tạo connection pool SQL Server dùng chung. Các route dùng thư viện `mssql` và tham số SQL.
- `backend/src/config/session.js` lưu phiên đăng nhập vào bảng `dbo.sessions`. Phiên hết hạn sau 30 phút không hoạt động; cookie được làm mới khi có thao tác.
- `backend/src/middleware/authenticate.js` xác định tài khoản từ session, không tin role/user ID do trình duyệt tự gửi. `requireRole` giới hạn vai trò; các API còn kiểm tra quyền sở hữu tin, hồ sơ hoặc hội thoại.

## 2. Khách chưa đăng nhập

### Tìm và xem tin tuyển dụng

1. Khách mở `index.html` hoặc `job-list.html`.
2. Frontend gọi `GET /api/jobs` để lấy tin còn mở; có thể tìm kiếm/lọc trên giao diện.
3. Khi mở `job-detail.html?id=...`, trang gọi `GET /api/jobs/:id`, hiển thị mô tả, yêu cầu, thu nhập, quyền lợi, công ty và hạn ứng tuyển.
4. Trang gọi `POST /api/jobs/:id/view` để ghi lượt xem. Backend không tính lượt xem của chính nhà tuyển dụng sở hữu tin và có giới hạn tốc độ.
5. Tin bị admin ẩn, tin của công ty bị đình chỉ hoặc tin hết hạn không được phục vụ như tin đang tuyển.

Khách có thể đọc trang công ty và một số trang hồ sơ công khai theo quyền API. Muốn lưu tin, ứng tuyển, nhắn tin hoặc xem các trang dành riêng cho tài khoản thì cần đăng nhập đúng vai trò.

### Phản ánh tin tuyển dụng

- Ứng viên đã đăng nhập mở biểu mẫu phản ánh ở cuối trang chi tiết tin.
- Form gửi tên, điện thoại, địa chỉ, email, nội dung và mã tin tới `POST /api/job-reports`.
- Backend xác thực dữ liệu, giới hạn số lần gửi và lưu vào `dbo.job_reports`; admin xem và xử lý trong khu vực quản trị.
- Đây là phản ánh được lưu trong hệ thống, không phải email tự động gửi tới admin.

## 3. Ứng viên

### Đăng ký, xác nhận email và đăng nhập

1. Tại `auth.html`, ứng viên nhập email và yêu cầu mã xác nhận.
2. `POST /api/auth/email/send-code` tạo OTP 6 chữ số, lưu hash trong `dbo.email_verifications` và gửi bằng SMTP.
3. OTP có thời hạn 5 phút; giới hạn 5 lần nhập sai, chờ 60 giây trước khi gửi lại. Xác minh bằng `POST /api/auth/email/verify-code` tạo verification token dùng một lần, hạn 10 phút.
4. Đăng ký gọi `POST /api/auth/register` cùng token. Backend kiểm tra token, băm mật khẩu Argon2id và tạo tài khoản `candidate` cùng hồ sơ liên quan.
5. Đăng nhập gọi `POST /api/auth/login`; thành công thì server tạo session và cookie HttpOnly. `POST /api/auth/logout` hủy session.

Đăng ký công khai chỉ dành cho `candidate` và `employer`; không có form tự đăng ký admin. Luồng OAuth Google/LinkedIn chưa được triển khai.

### Hồ sơ và trạng thái tìm việc

- `candidate/profile.html`/`candidate/account.html` hiển thị hoặc cập nhật thông tin tài khoản, hồ sơ qua `/api/me` và `PATCH /api/me/profile`.
- Ứng viên quản lý trạng thái tìm việc trong phần bảo mật; backend lưu `search_status`. Danh sách ứng viên tìm việc của nhà tuyển dụng chỉ trả hồ sơ phù hợp với chính sách hiển thị.
- Có trang xem lượt nhà tuyển dụng đã xem hồ sơ (`candidate/profile-views.html`). Nhà tuyển dụng mở hồ sơ qua trang candidate profile; backend ghi nhận lượt xem theo ngày vào `dbo.profile_views`.

### Tìm việc, lưu tin và ứng tuyển

1. Ứng viên tìm tin ở `job-list.html`, xem nội dung ở `job-detail.html`.
2. Nút lưu tin gọi `/api/saved-jobs`; dữ liệu gắn với ứng viên trong `dbo.saved_jobs`. Trang `candidate/saved-jobs.html` liệt kê các tin đã lưu.
3. Khi ứng tuyển, `candidate/apply.html` hiển thị thông tin công ty/tin, cho chọn CV đã tải lên hoặc nhập nội dung giới thiệu. Submit gửi `POST /api/applications`; backend kiểm tra session, role, quyền sở hữu CV, tin còn nhận hồ sơ và giới hạn số lần gửi rồi lưu vào `dbo.applications`.
4. CV tệp hỗ trợ PDF/DOC/DOCX tối đa 10 MB. File lưu ở thư mục riêng không nằm trong static hosting; SQL Server lưu metadata và `cv_id`. Tải xuống chỉ cho chủ CV, admin hoặc nhà tuyển dụng có application liên quan.
5. Trang `candidate/my-applications.html` là lịch sử hồ sơ. Trạng thái được đọc từ API; ứng viên có thể rút đơn bằng `DELETE /api/applications/:id` khi còn ở trạng thái cho phép. Rút hồ sơ là cập nhật trạng thái `withdrawn`, không xóa cứng.
6. Nếu đã rút, ứng viên có thể nộp lại vào cùng tin (trừ khi đang có hợp tác còn hiệu lực với công ty đó).

### Quy tắc trúng tuyển và hợp tác

- Khi nhà tuyển dụng đánh dấu **Đậu**, trạng thái đơn thành `accepted`.
- Chừng nào ứng viên còn `accepted`/`hired` tại công ty A, backend chặn ứng tuyển các tin khác của A. Ứng viên vẫn được nộp vào công ty B.
- Nhà tuyển dụng kết thúc hợp tác trên trang ứng viên trúng tuyển; trạng thái chuyển thành `employment_ended`. Sau đó ứng viên có thể ứng tuyển lại tại công ty A.
- Trang `candidate/accepted-jobs.html` hiển thị các hồ sơ trúng tuyển/đã nhận việc.

### Lịch phỏng vấn

- Nhà tuyển dụng đặt hoặc cập nhật lịch; ứng viên xem ở `candidate/interviews.html`.
- Ứng viên có thể xác nhận hoặc từ chối lịch. Chức năng xin đổi lịch đã được bỏ.
- Nhà tuyển dụng quyết định trực tiếp **Đậu** hoặc **Không đạt** sau phỏng vấn. API cập nhật lịch phỏng vấn sang `completed` và cập nhật riêng trạng thái đơn ứng tuyển (`accepted` hoặc `rejected`) trong một transaction.
- Danh sách lịch sắp xếp lịch được tạo gần đây lên đầu.

### Lời mời, tin nhắn và các trang CV

- `candidate/employer-invites.html` nhận lời mời kết nối của nhà tuyển dụng và cho phép đồng ý/từ chối qua `/api/invites`.
- `candidate/messages.html` gửi/đọc tin nhắn với nhà tuyển dụng qua `/api/messages`. Hội thoại truy cập theo người liên hệ, tin nhắn có trạng thái đã đọc; dữ liệu lưu ở SQL Server.
- `candidate/my-cv.html` tải lên, tải xuống, đặt CV mặc định và xóa CV chưa được sử dụng. `candidate/cover-letter.html` tạo, sửa và xóa mẫu cover letter trong database.

## 4. Nhà tuyển dụng

### Đăng ký và hồ sơ công ty

- Tài khoản nhà tuyển dụng đăng ký qua xác thực email như ứng viên. Backend tạo liên kết tài khoản với bản ghi công ty.
- `employer/company-profile.html` hiển thị hồ sơ công khai; `employer/edit-company.html` sửa tên, ngành, quy mô, địa điểm, website, mô tả và logo.
- API `GET/POST/PUT /api/employer/company` giới hạn dữ liệu theo `employer_id` của session. Logo nhận PNG/JPG/WebP, tối đa 2 MB, kiểm tra chữ ký file và lưu trong `employer/uploads/companies`; SQL lưu thông tin/đường dẫn.
- `company-profile.html?id=...` là trang công khai xem hồ sơ doanh nghiệp. Trang có thể hiển thị tin tuyển dụng của công ty khi truy vấn liên kết công ty–tin phù hợp.

### Đăng và quản lý tin

1. `employer/post-job.html` nhập tiêu đề, mô tả, yêu cầu, quyền lợi, ngành nghề, địa điểm, hình thức, kinh nghiệm, khoảng lương và hạn ứng tuyển.
2. `POST /api/employer/jobs` xác thực employer, lấy công ty từ tài khoản hiện tại, kiểm tra dữ liệu rồi lưu vào `dbo.jobs`. Tin mới được tạo ở trạng thái active theo cấu hình hiện tại.
3. `employer/my-jobs.html` gọi API tin của nhà tuyển dụng để xem danh sách. Nhà tuyển dụng có thể sửa ở `edit-job.html` hoặc đóng tin.
4. API chỉ cho phép chủ tin sửa/đóng tin. Nếu admin ẩn tin hoặc tin hết hạn, tin không xuất hiện công khai và giao diện quản lý thể hiện trạng thái đóng/ẩn.

### Tìm ứng viên và xử lý hồ sơ

- `employer/applicants.html`/`saved-candidates.html` liệt kê ứng viên tìm việc hoặc ứng viên đã lưu. Mở hồ sơ ứng viên qua trang chi tiết; backend ghi lượt xem.
- Trang danh sách ứng viên lấy dữ liệu từ API; nút **Lưu**, **Mời kết nối**, **Xem hồ sơ** và **Liên hệ** đều gọi luồng xử lý. Danh sách lưu được lưu riêng theo employer trong `dbo.employer_saved_candidates`.
- `employer/applied-candidates.html` liệt kê đơn của các tin thuộc nhà tuyển dụng. Khi bấm **Xem chi tiết**, nếu đơn còn `applied`, hệ thống tự chuyển sang `reviewing` rồi mở trang ứng viên của tin.
- `employer/job-applicants.html?id=...` xem nội dung CV dạng văn bản, nhắn tin, đặt/cập nhật lịch, hoặc từ chối hồ sơ. Các trạng thái lịch sử vẫn được giữ trong danh sách, không xóa đơn khi đổi trạng thái.
- Luồng trạng thái hiện dùng: `applied` → `reviewing` → `interview_invited` → nhà tuyển dụng chọn `accepted` (đậu) hoặc `rejected` (không đạt). Candidate rút đơn thành `withdrawn`. Các trạng thái offer cũ còn được nhận diện để tương thích dữ liệu lịch sử nhưng không còn là luồng thao tác hiện tại.
- `employer/accepted-candidates.html` liệt kê ứng viên đậu. Nút kết thúc hợp tác chuyển trạng thái sang `employment_ended`; đơn vẫn còn trong lịch sử.

### Đặt lịch và quyết định phỏng vấn

1. Nhà tuyển dụng đặt lịch từ hồ sơ ứng viên hoặc cập nhật lịch cũ; API `POST /api/interviews` kiểm tra quyền sở hữu tin, ngày/giờ/hình thức và lưu vào `dbo.interviews`.
2. Lịch được lưu tách khỏi `applications.status`: lịch có trạng thái `scheduled`, `confirmed`, `declined`, `completed`, `canceled` hoặc `no_show`; đơn có trạng thái tuyển dụng.
3. Ứng viên xác nhận/từ chối lịch. Lịch mới nhất hiện đầu danh sách `employer/interviews.html`.
4. Sau phỏng vấn, nhà tuyển dụng bấm **Đậu** hoặc **Không đạt**. API kiểm tra lịch thuộc tin của employer, chỉ cho quyết định lịch chưa xử lý, sau đó cập nhật lịch và đơn cùng transaction.

### Tin nhắn, mời ứng viên và tài khoản

- `employer/messages.html` trao đổi với ứng viên bằng API messages.
- Nhà tuyển dụng có thể gửi lời mời tới ứng viên qua `/api/invites`, có thể gắn với tin tuyển dụng; chỉ candidate được mời có thể trả lời.
- `employer/account.html` và `password.html` quản lý thông tin tài khoản/đổi mật khẩu qua `/api/me`.
- Trang stats cũ vẫn có trong source nhưng các mục báo cáo/thống kê nhà tuyển dụng đã được ẩn khỏi sidebar do chưa hoàn thiện đầy đủ.

## 5. Quản trị viên

Admin không đăng ký công khai. Tài khoản được tạo/nâng quyền bằng `backend/scripts/seed-admin.js` và mật khẩu Argon2id. Trang hiện tại là `admin/dashboard.html`; API trong `backend/src/routes/admin.routes.js` yêu cầu session và role `admin`.

- **Tổng quan:** `GET /api/admin/overview` trả số liệu người dùng, tin, đơn và người dùng mới.
- **Quản lý người dùng:** tìm kiếm/lọc danh sách; khóa/mở khóa candidate hoặc employer. Lý do thao tác được lưu để kiểm toán.
- **Quản lý tin:** xem tin; ẩn/khôi phục tin bằng `admin_visibility`. Tin không bị xóa cứng.
- **Quản lý công ty:** xem danh sách; đình chỉ/khôi phục bằng trạng thái admin.
- **Phản ánh tin:** xem hàng đợi `dbo.job_reports`, đổi trạng thái xử lý và ghi chú/kết quả.
- **Nhật ký:** xem `dbo.admin_audit_logs` để truy lại thao tác quản trị.
- Khóa tài khoản, ẩn tin và đình chỉ công ty đều được kiểm tra ở backend; ẩn giao diện không thay thế kiểm tra quyền API.

## 6. Email, thông báo và bảo mật

- Email hiện được gửi để xác nhận địa chỉ khi đăng ký. Cấu hình SMTP nằm ở biến môi trường; không có mật khẩu SMTP thật trong tài liệu này.
- Chưa có email thông báo khi ứng viên nộp hồ sơ, được mời phỏng vấn, đậu/không đạt, rút hồ sơ hoặc khi employer nhận phản ánh.
- Notification badge trên sidebar dựa trên dữ liệu ứng tuyển, lịch phỏng vấn, lời mời và lượt xem hồ sơ; đây không đồng nghĩa đã có email hoặc push notification.
- API xác thực bằng session lưu SQL Server; mật khẩu băm Argon2id; request SQL dùng parameter; API có rate limit ở các luồng nhạy cảm như đăng nhập/OTP/ứng tuyển/tin nhắn/phản ánh.
- CV có thể gửi dạng text hoặc tệp PDF/DOC/DOCX. CV tệp nằm ngoài vùng static và cần được sao lưu khi deploy. Logo công ty hiện nằm dưới `employer/uploads/companies` trong project.

## 7. Chức năng có giao diện nhưng chưa hoàn chỉnh

| Trang/nhóm | Tình trạng trong source |
|---|---|
| OAuth Google/LinkedIn | Chưa có API/provider callback hoặc liên kết tài khoản. |
| Email nghiệp vụ | Chưa có ngoài OTP đăng ký. |
| Một số trang thống kê employer cũ | Tệp còn trong project nhưng mục điều hướng đã ẩn; cần kiểm tra riêng trước khi dùng vì chưa nằm trong luồng chính. |

## 8. Các nhóm API chính

| Prefix | Chức năng |
|---|---|
| `/api/auth` | OTP email, đăng ký, đăng nhập, đăng xuất. |
| `/api/me` | Tài khoản hiện tại, cập nhật hồ sơ, đổi mật khẩu. |
| `/api/jobs` | Danh sách/chi tiết tin công khai, lượt xem. |
| `/api/employer/jobs` | Employer tạo, sửa, đóng tin thuộc sở hữu. |
| `/api/applications` | Ứng tuyển, kiểm tra điều kiện, danh sách, cập nhật trạng thái, rút hồ sơ. |
| `/api/interviews` | Đặt lịch, đọc lịch, candidate phản hồi, employer quyết định kết quả. |
| `/api/saved-jobs` | Danh sách/lưu/bỏ lưu tin. |
| `/api/messages` | Danh sách hội thoại, lịch sử, gửi và đánh dấu đã đọc. |
| `/api/invites` | Employer gửi lời mời; candidate trả lời. |
| `/api/profile-views` | Ghi lượt xem hồ sơ và candidate đọc lịch sử. |
| `/api/employer/company`, `/api/companies` | Sửa hồ sơ công ty riêng và đọc hồ sơ công khai. |
| `/api/job-reports`, `/api/admin` | Gửi phản ánh và các thao tác quản trị. |
| `/api/health` | Kiểm tra API và kết nối database. |

## 9. Các bảng dữ liệu nghiệp vụ chính

- `users`: tài khoản, role, thông tin liên hệ, trạng thái tài khoản.
- `candidate_profiles`: thông tin nghề nghiệp và trạng thái tìm việc.
- `candidate_cvs`, `cover_letters`: file CV và mẫu cover letter thuộc ứng viên.
- `employer_saved_candidates`: danh sách ứng viên đã lưu theo từng employer.
- `companies`: công ty thuộc employer, logo, ngành, quy mô, website, mô tả và trạng thái quản trị.
- `jobs`: tin tuyển dụng, nội dung, khoảng lương, hạn, trạng thái công khai và trạng thái admin.
- `applications`: quan hệ ứng viên–tin, nội dung CV text, trạng thái ứng tuyển, thời điểm.
- `interviews`: lịch và trạng thái cuộc phỏng vấn tách biệt với đơn ứng tuyển.
- `saved_jobs`, `messages`, `invites`, `profile_views`: lưu tin, trò chuyện, lời mời kết nối, lượt xem hồ sơ.
- `email_verifications`, `sessions`: xác minh email và phiên đăng nhập.
- `job_reports`, `admin_audit_logs`: hàng đợi phản ánh và nhật ký quản trị.

Schema SQL Server trên máy triển khai phải có các cột/constraint tương thích với migrations và query hiện tại. Việc có route trong source chưa khẳng định schema runtime đã được cập nhật hoặc kết nối production đã được kiểm thử.
