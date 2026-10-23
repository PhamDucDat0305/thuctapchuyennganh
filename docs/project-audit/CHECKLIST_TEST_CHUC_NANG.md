# Checklist kiểm thử chức năng JobViệt

Tài liệu này là kế hoạch kiểm thử thủ công theo source hiện tại. Các ô đều để trống vì chưa chạy lại ứng dụng/SQL Server sau đợt sửa gần nhất. Chỉ thử trên database phát triển với tài khoản và dữ liệu giả.

## 1. Chuẩn bị môi trường

- [ ] Backup database phát triển hoặc dùng database test có thể khôi phục.
- [ ] Xác nhận các bảng lõi `dbo.users`, `dbo.companies`, `dbo.jobs` và các bảng migration cần thiết đã tồn tại, đúng schema API.
- [ ] Chạy backend trong `backend/` bằng `npm run dev`; ghi lại log startup.
- [ ] Xác nhận log có `[db] Đã kết nối SQL Server` và `[session] Đã kết nối SQL Server session store`.
- [ ] Mở frontend qua web server tĩnh, ví dụ Live Server tại `http://localhost:5500`; không mở HTML bằng `file://`.
- [ ] Kiểm tra `GET http://localhost:3000/api/health` và `/api/health/db` trả trạng thái thành công.
- [ ] Tạo dữ liệu giả: 2 candidate (một đang bật tìm việc, một đã ẩn), 2 employer, một admin được cấp riêng, job active/closed/expired, application, invite, interview và conversation.

> Không dùng production hoặc dữ liệu cá nhân. Thử rate limit có thể chặn tạm IP/tài khoản; không chạy lặp trong môi trường dùng chung.

## 2. Khách và xác thực

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| AUTH-01 | Mở trang chủ, trang danh sách việc và trang giới thiệu khi chưa đăng nhập. | Trang công khai tải được; việc đóng/hết hạn không xuất hiện trong danh sách công khai. | ☐ Đạt ☐ Lỗi |
| AUTH-02 | Đăng ký candidate với thông tin hợp lệ. | Tạo user role `candidate`, hồ sơ candidate và đăng nhập ngay; mật khẩu không lưu dạng nguyên văn. | ☐ Đạt ☐ Lỗi |
| AUTH-03 | Đăng ký employer, nhập tên công ty. | Tạo user `employer` và company có đúng tên vừa nhập; không tự ghép tên công ty từ họ tên. | ☐ Đạt ☐ Lỗi |
| AUTH-04 | Bỏ trống tên công ty khi chọn employer; thử email sai, mật khẩu dưới 8 ký tự hoặc role không hợp lệ. | Form/API từ chối và hiển thị lỗi; không tạo record dở dang. | ☐ Đạt ☐ Lỗi |
| AUTH-05 | Đăng ký lại cùng email. | API trả lỗi trùng email (409); không tạo user thứ hai. | ☐ Đạt ☐ Lỗi |
| AUTH-06 | Đăng nhập sai mật khẩu và email không tồn tại. | Cùng trả thông báo credentials không đúng; không tạo session. | ☐ Đạt ☐ Lỗi |
| AUTH-07 | Đăng nhập đúng, tải lại trang, mở `/api/me`, rồi đăng xuất. | Session còn hiệu lực sau tải lại; `/api/me` trả user; sau logout `/api/me` trả 401. | ☐ Đạt ☐ Lỗi |
| AUTH-08 | Thử mở trang employer bằng candidate và ngược lại. | Bị chuyển hướng/chặn theo role; API vẫn từ chối truy cập trái quyền. | ☐ Đạt ☐ Lỗi |
| AUTH-09 | Gửi mật khẩu mới đúng/sai mật khẩu hiện tại tại trang đổi mật khẩu. | Mật khẩu cũ sai bị từ chối; mật khẩu mới hợp lệ dùng được cho lần đăng nhập kế tiếp. | ☐ Đạt ☐ Lỗi |

## 3. Hồ sơ và quyền riêng tư ứng viên

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| PRIV-01 | Candidate sửa họ tên, điện thoại và hồ sơ nghề nghiệp của chính mình. | Dữ liệu lưu và tải lại đúng; field quá dài hoặc sai kiểu bị từ chối. | ☐ Đạt ☐ Lỗi |
| PRIV-02 | Candidate tắt “đang tìm việc”; employer tải danh sách ứng viên. | Candidate đã ẩn không xuất hiện trong danh sách. | ☐ Đạt ☐ Lỗi |
| PRIV-03 | Employer gọi `GET /api/users/:id` của candidate đã ẩn, không có application. | Không trả hồ sơ (404). | ☐ Đạt ☐ Lỗi |
| PRIV-04 | Candidate A gọi `GET /api/users/:id` của candidate B. | Không xem được hồ sơ người khác (404). | ☐ Đạt ☐ Lỗi |
| PRIV-05 | Employer gọi hồ sơ candidate đang bật tìm việc. | Xem được thông tin nghề nghiệp cần thiết; email/điện thoại không hiện trước khi có application. | ☐ Đạt ☐ Lỗi |
| PRIV-06 | Employer sở hữu application gọi hồ sơ candidate đã ẩn. | Xem được hồ sơ liên quan, gồm email/điện thoại theo policy hiện tại. Employer khác vẫn bị chặn. | ☐ Đạt ☐ Lỗi |
| PRIV-07 | Gọi cập nhật `searchStatus` bằng employer. | API trả 403; chỉ candidate tự quản lý trạng thái tìm việc. | ☐ Đạt ☐ Lỗi |
| PRIV-08 | Gọi `PATCH /api/me/profile` với `twoFactorEnabled`. | API từ chối; UI ghi rõ 2FA chưa khả dụng, không hiển thị “đã bật”. | ☐ Đạt ☐ Lỗi |
| PRIV-09 | Mở lịch sử đăng nhập trên trang bảo mật employer. | Hiện thông báo chưa hỗ trợ, không còn các bản ghi thiết bị/IP giả. | ☐ Đạt ☐ Lỗi |

## 4. Tin tuyển dụng và lượt xem

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| JOB-01 | Employer tạo tin với đủ trường bắt buộc. | Tạo tin thuộc employer hiện tại, trạng thái active; hiển thị trên trang việc làm. | ☐ Đạt ☐ Lỗi |
| JOB-02 | Bỏ trống trường bắt buộc, nhập type không hợp lệ hoặc vượt giới hạn. | API trả 400 và không tạo/cập nhật tin. | ☐ Đạt ☐ Lỗi |
| JOB-03 | Employer sửa/đóng tin của mình. | Thay đổi lưu đúng; tin đóng không còn ở danh sách công khai. | ☐ Đạt ☐ Lỗi |
| JOB-04 | Employer A sửa/đóng tin của employer B bằng ID. | API trả 404/không cho thay đổi. | ☐ Đạt ☐ Lỗi |
| JOB-05 | Mở job active, sau đó refresh trong cùng session browser. | Trang hiển thị đúng; frontend chỉ ghi nhận tối đa một view/job trong session đó. | ☐ Đạt ☐ Lỗi |
| JOB-06 | Recruiter tự mở tin của mình. | View count không tăng. | ☐ Đạt ☐ Lỗi |
| JOB-07 | Gọi API view với ID không hợp lệ/tin closed. | ID sai trả 400; tin không khả dụng không được cộng view. | ☐ Đạt ☐ Lỗi |
| JOB-08 | Gửi hơn 60 request view từ cùng IP trong 10 phút (chỉ trên môi trường cô lập). | Sau quota, API trả 429 và `Retry-After`; không tiếp tục tăng view. | ☐ Đạt ☐ Lỗi |

## 5. Ứng tuyển và phỏng vấn

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| APP-01 | Candidate ứng tuyển job active bằng nội dung giới thiệu dạng text. | Tạo application; UI ghi rõ đây là text và chưa hỗ trợ tải tệp CV. | ☐ Đạt ☐ Lỗi |
| APP-02 | Ứng tuyển job closed/expired, CV rỗng/quá dài. | API từ chối phù hợp; không tạo application. | ☐ Đạt ☐ Lỗi |
| APP-03 | Candidate ứng tuyển lần hai cùng job. | Trả lỗi duplicate (409); chỉ có một application cho candidate/job. | ☐ Đạt ☐ Lỗi |
| APP-04 | Candidate xem và hủy application còn ở trạng thái cho phép hủy. | Chỉ thấy đơn của mình; đơn hủy biến mất/được xử lý đúng trên UI. | ☐ Đạt ☐ Lỗi |
| APP-05 | Employer A xem danh sách ứng viên của job mình và thử truy cập application/job của employer B. | Chỉ dữ liệu job thuộc employer A; truy cập của B bị từ chối. | ☐ Đạt ☐ Lỗi |
| APP-06 | Employer đổi trạng thái application sang accepted/rejected và thử status không hợp lệ. | Trạng thái hợp lệ được lưu; status ngoài whitelist bị 400; application vẫn tồn tại sau khi đổi trạng thái. | ☐ Đạt ☐ Lỗi |
| APP-07 | Nhập chuỗi HTML/script vô hại trong nội dung CV test, xem ở trang employer. | Chuỗi được hiển thị như văn bản, không chạy HTML/script. | ☐ Đạt ☐ Lỗi |
| INT-01 | Employer đặt lịch phỏng vấn với ngày hợp lệ, giờ HH:mm và online/offline. | Lịch được lưu; application chuyển sang `interview_scheduled`; candidate nhìn thấy lịch. | ☐ Đạt ☐ Lỗi |
| INT-02 | Thử ngày không tồn tại, giờ sai định dạng, loại hình sai hoặc application của employer khác. | API từ chối 400/404; không tạo lịch ngoài quyền sở hữu. | ☐ Đạt ☐ Lỗi |
| INT-03 | Employer cập nhật lại lịch cho application đã có interview. | Cập nhật một interview hiện có, không sinh bản ghi trùng. | ☐ Đạt ☐ Lỗi |

## 6. Công ty, việc đã lưu, lời mời và lượt xem hồ sơ

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| CO-01 | Employer cập nhật tên, ngành, quy mô, website, địa chỉ công ty rồi tải lại trang. | Dữ liệu lưu đúng; website sai định dạng và chuỗi quá dài bị từ chối. | ☐ Đạt ☐ Lỗi |
| SAVE-01 | Candidate lưu một job active, kiểm tra danh sách, bỏ lưu, rồi thử job closed. | Toggle lưu/bỏ lưu phản ánh đúng; job closed không lưu mới được. | ☐ Đạt ☐ Lỗi |
| INV-01 | Employer gửi lời mời cho candidate tìm việc; candidate chấp nhận/từ chối. | Lời mời hiển thị đúng hai phía; chỉ candidate nhận lời mời mới đổi trạng thái; gửi lặp khi pending bị chặn. | ☐ Đạt ☐ Lỗi |
| VIEW-01 | Employer xem hồ sơ candidate test; candidate mở trang lượt xem hồ sơ. | Có record employer/company và thời điểm; cùng employer-candidate trong ngày UTC được gộp theo logic hiện tại. | ☐ Đạt ☐ Lỗi |
| VIEW-02 | Employer gửi candidateId không tồn tại hoặc trỏ tới account không phải candidate. | API trả 404; không ghi lượt xem. | ☐ Đạt ☐ Lỗi |

## 7. Tin nhắn

| ID | Thao tác | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| MSG-01 | Candidate và employer có conversation gửi tin hai chiều. | Tin hiển thị đúng người gửi/nội dung/thời gian; refresh không làm trắng khung chat. | ☐ Đạt ☐ Lỗi |
| MSG-02 | Gửi rỗng, trên 2.000 ký tự, receiver không tồn tại hoặc tự gửi cho mình. | API từ chối với thông báo phù hợp; không tạo message. | ☐ Đạt ☐ Lỗi |
| MSG-03 | Đánh dấu tin đã đọc. | Unread count giảm và trạng thái đọc được cập nhật đúng người nhận. | ☐ Đạt ☐ Lỗi |
| MSG-04 | Conversation có trên 50 tin; tải tin cũ, refresh danh sách hội thoại và mở bằng URL `?to=...`. | Lịch sử tải theo trang 50, cursor không lặp/mất tin; contact lấy từ danh sách conversation. | ☐ Đạt ☐ Lỗi |
| MSG-05 | Gửi quá 30 tin trong một phút bằng cùng tài khoản (chỉ môi trường cô lập). | API trả 429 sau quota. | ☐ Đạt ☐ Lỗi |
| MSG-06 | Gửi nội dung HTML/script vô hại, mở trên hai role. | Nội dung hiển thị như text, không thực thi markup. | ☐ Đạt ☐ Lỗi |

## 8. Kiểm tra thay đổi gần nhất

- [ ] **Không còn Firebase:** mở DevTools → Network, lọc `firebase`/`googleapis`; không có request Firebase từ ứng dụng. Kiểm tra các key legacy trong localStorage vẫn còn nguyên, không bị tự xóa.
- [ ] **Rate limit:** xác nhận response 429 và `Retry-After` trên test riêng. Quota hiện tại: login 10/15 phút/IP; register 5/giờ/IP; message 30/phút/user; application 10/giờ/user; invite 20/giờ/user; job view 60/10 phút/IP.
- [ ] **Session startup:** restart backend; session store phải kết nối trước khi server listen. Theo dõi xem còn log `Connection is closed` khi tải trang/gửi request đồng thời hay không.
- [ ] **Frontend/API lỗi:** tắt backend tạm thời trên môi trường dev, xác nhận UI hiện thông báo hữu ích; bật lại và xác nhận ứng dụng phục hồi sau reload.
- [ ] **CORS/session cookie:** thử frontend ở origin được allowlist; login/session hoạt động với cookie. Origin lạ không được phép dùng credentialed API.

## 9. Kiểm tra SQL Server và báo cáo lỗi

- [ ] Sau mỗi luồng ghi, đối chiếu record bằng SELECT chỉ trên database test; không truy vấn/ghi mật khẩu gốc.
- [ ] Xác nhận không có dữ liệu trùng application/interview/view trong các thao tác lặp.
- [ ] Nếu gặp lỗi, ghi lại: mã test, bước thực hiện, status/response API, log backend đã che email/IP/token/secret, và kết quả SELECT tối thiểu liên quan.
- [ ] Đánh dấu từng dòng **Đạt / Lỗi / Bỏ qua**, kèm ngày chạy, commit đang chạy và môi trường/database.

## 10. Các mục chưa thể xác nhận bằng checklist UI đơn thuần

- Dựng database mới từ đầu: repository hiện thiếu baseline DDL cho `users`, `companies`, `jobs`.
- Chạy lại migration trên schema legacy: cần backup/bản sao database và xác nhận cột, constraint, index trước khi thay đổi.
- Phân trang cho các API danh sách và tối ưu query conversations: chưa được triển khai; checklist cần bổ sung khi hoàn tất API/UI pagination.
- Rate limiter in-memory không chia sẻ quota giữa nhiều tiến trình/backend instance.
