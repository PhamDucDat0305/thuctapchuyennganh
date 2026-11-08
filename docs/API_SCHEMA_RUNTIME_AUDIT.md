# API, phân quyền và schema — rà soát source

Ngày rà soát: 2026-11-08. Đây là kiểm tra source và cấu hình local, không phải chứng nhận runtime production. Kết nối SQL Server local bị từ chối tại `localhost:1433`; vì vậy chưa thể khẳng định migrations chạy được trên database thật hoặc các API nghiệp vụ chạy qua dữ liệu thật.

## Phân quyền API

| Nhóm API | Phạm vi quyền đang kiểm tra trong source |
|---|---|
| `/api/auth/*` | Đăng ký chỉ candidate/employer; OTP có rate limit; login/session phía server. |
| `/api/me/*` | Session bắt buộc; dữ liệu người dùng lấy từ session đã đối chiếu `dbo.users`. |
| `/api/jobs` và `/api/stats` | Đọc công khai; jobs chỉ active, chưa hết hạn, không bị admin ẩn, công ty active và employer không bị khóa. |
| `/api/jobs/:id/view` | Ghi lượt xem có rate limit; không tăng lượt chủ tin. |
| `/api/employer/jobs/*` | Employer; truy vấn/sửa/đóng theo recruiter sở hữu. |
| `/api/applications/*` | Session và role; danh sách candidate/employer được lọc theo chủ thể; POST candidate; GET theo tin employer ownership; PATCH theo candidate hoặc recruiter; DELETE là rút hồ sơ, không xóa hàng. |
| `/api/interviews/*` | Session/role; đọc theo candidate/recruiter; tạo và quyết định kết quả yêu cầu employer sở hữu tin; phản hồi lịch yêu cầu candidate là người nhận. |
| `/api/saved-jobs/*` | Candidate; khóa theo candidate từ session; bỏ lưu hoạt động cả khi tin đã đóng. |
| `/api/employer/saved-candidates/*` | Employer; thao tác gắn với employer trong session và ứng viên active/tìm việc. |
| `/api/candidate-content/*` | Candidate quản lý CV/cover letter của mình; employer chỉ tải CV khi có application với tin của họ; admin có thể tải CV. |
| `/api/messages/*` | Candidate/employer; lịch sử và đọc tin theo cặp người dùng, gửi giới hạn nội dung. |
| `/api/invites/*` | Employer gửi, candidate nhận và chỉ candidate sở hữu lời mời được phản hồi. |
| `/api/profile-views/*` | Employer ghi lượt xem; candidate đọc lịch sử của mình. |
| `/api/job-reports/*` | Candidate gửi phản ánh; `/api/admin/*` chỉ admin và thao tác quản trị có audit log. |

## Thay đổi đã hoàn tất trong source

- Bỏ hardcode/dữ liệu mẫu tại `employer/saved-candidates.html`, `candidate/my-cv.html`, `candidate/cover-letter.html`.
- Thêm `dbo.employer_saved_candidates`; employer có thể lưu/bỏ lưu ứng viên và xem danh sách đã lưu riêng của họ.
- Thêm CRUD cover letter theo `candidate_id`.
- Thêm thư viện CV: upload PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP (tối đa 10 MB), tên file máy chủ ngẫu nhiên, kiểm tra phần mở rộng/chữ ký cơ bản, download có kiểm tra quyền. File nằm trong thư mục `private_uploads/cvs`, không thuộc thư mục static mà Express public; SQL Server lưu metadata chứ không lưu nội dung file. Employer mất quyền tải CV của application sau khi candidate rút hồ sơ.
- Có thể chọn CV đã tải lên hoặc nhập CV text khi ứng tuyển. `applications.cv_id` tham chiếu CV; CV đang được sử dụng không thể xóa. Database chỉ nhận application CV thuộc candidate hiện tại.
- Rút hồ sơ chuyển `status=withdrawn`; ứng tuyển lại cùng tin cập nhật đơn cũ. Sau khi `employment_ended`, có thể ứng tuyển lại cùng tin. Khi `accepted`/`hired`, ứng tuyển tin khác cùng công ty bị chặn; công ty khác không bị chặn.
- Kết thúc hợp tác dùng riêng trạng thái `employment_ended`, không giả làm `rejected`.
- Lưu tin và lời mời có kiểm soát transaction/unique index để giảm ghi trùng khi request đồng thời. Lời mời trùng pending cũ phải được xử lý trước khi thêm index migration.
- Lượt xem hồ sơ chỉ được tính một lần cho mỗi cặp employer/candidate; migration 016 gộp lịch sử trùng và thêm unique index để chặn ghi trùng.
- Loại bỏ các nút giả “Lên lịch mới” và “Gửi thông báo” dạng toast; thống kê không còn số lượt xem/chi phí giả lập.

## Migration cần có

Trong SSMS chọn `job_viet` và đảm bảo các migration cơ sở (`001`–`013`) đã chạy phù hợp với source trước. Sau đó chạy `backend/sql/014_candidate_content.sql`. Script thêm các bảng CV/cover letter/saved candidates, thêm `applications.cv_id`, cho phép application dùng file CV mà không cần CV text và thêm unique index cho lời mời pending. Nếu `dbo.candidate_cvs` đã tồn tại từ schema cũ, chạy tiếp `backend/sql/015_repair_candidate_cvs_original_name.sql`; migration 014 chỉ tạo bảng khi bảng chưa tồn tại, không tự bổ sung metadata cho bảng cũ. Migration 015 bổ sung các cột metadata CV còn thiếu; bản ghi cũ không có tệp thật được đánh dấu là không khả dụng và cần ứng viên tải CV mới. Cuối cùng chạy `backend/sql/016_unique_profile_view_per_employer.sql` để gộp lượt xem trùng và áp dụng quy tắc mỗi employer chỉ được tính một lượt cho mỗi candidate.

Migration `014` thêm composite FK `(applications.candidate_id, applications.cv_id)` tới cùng candidate owner của CV; SQL cũng ngăn application trỏ sang CV thuộc tài khoản khác. Migration dừng nếu phát hiện lời mời pending trùng. Xem các nhóm trùng trước khi quyết định giữ bản nào:

```sql
SELECT employer_id, candidate_id, job_id, COUNT(*) AS duplicate_count
FROM dbo.invites
WHERE status = N'pending' AND job_id IS NOT NULL
GROUP BY employer_id, candidate_id, job_id
HAVING COUNT(*) > 1;

SELECT employer_id, candidate_id, COUNT(*) AS duplicate_count
FROM dbo.invites
WHERE status = N'pending' AND job_id IS NULL
GROUP BY employer_id, candidate_id
HAVING COUNT(*) > 1;
```

Không xóa application, tin, CV hay lời mời cũ tự động trong migration. Foreign key chặn xóa CV đang được application dùng; các application được giữ làm lịch sử.

## Kiểm tra đã thực hiện trong môi trường này

- `node --check` thành công với route application, interview, candidate content, employer saved-candidates và app Express.
- Parse inline ES modules thành công trên 33 trang candidate/employer.
- Không còn `Math.random`, nội dung “Giả lập”/“Đang phát triển” hoặc nút toast giả trong các trang candidate/employer/admin được rà. Toast ghi nhận kết quả sau thao tác API vẫn còn và là phản hồi hợp lệ.
- Không chạy được test server HTTP cục bộ: test harness nhận `connect EACCES 127.0.0.1:<port>` khi mở listener loopback trong sandbox.
- Không kiểm tra được schema hoặc API với database thật: Node driver kết nối `localhost:1433` nhận `ECONNREFUSED`. Vì vậy migration 014 chưa được thực thi và thao tác CRUD mới chưa thể xác nhận trên SQL Server ở môi trường này.

## Kịch bản nghiệm thu cần chạy khi SQL Server/backend truy cập được

1. Chạy `/api/health/db`; xác nhận database là `job_viet`, migration 013/014 có đủ bảng, cột, FK, check constraints và filtered indexes.
2. Candidate A tải PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP; thử file sai phần mở rộng/chữ ký, file rỗng và file lớn hơn 10 MB. Candidate B không được tải/xóa/set default CV của A.
3. Employer của application tải được CV gắn đơn; employer không liên quan nhận 404 khi thử URL CV đó.
4. Candidate tạo/sửa/xóa cover letter; candidate khác không đọc/sửa/xóa được ID đó.
5. Employer A lưu candidate; danh sách của A có candidate, employer B không thấy; lưu lặp trả thành công idempotent; bỏ lưu xong record biến mất.
6. Candidate nộp application bằng file CV; xác nhận `applications.cv_id` và CV download; thử CV của candidate khác phải bị từ chối.
7. Rút đơn; cùng tin nộp lại được. Trong lúc status `accepted`/`hired`, tin công ty khác nhận application, tin khác cùng company trả 409. Chuyển `employment_ended`, application tới cùng tin/công ty được phép.
8. Đóng tin/admin ẩn tin: không tạo application hoặc saved-job mới. Bỏ saved-job của tin cũ vẫn hoạt động.
9. Gửi lời mời cùng employer/candidate/job hai request đồng thời; chỉ có một pending record và request còn lại nhận 409.
10. Chạy ma trận 401/403/404 cho các endpoint private bằng guest, role sai, owner đúng và owner sai; kiểm tra log không lộ password/token/file path.

Đến khi chạy hết các mục trên với SQL Server thật, trạng thái là **source đã được cập nhật, runtime database/API chưa được nghiệm thu**.
