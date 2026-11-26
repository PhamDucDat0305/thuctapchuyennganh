# Sequelize models

Các model trong thư mục này ánh xạ những bảng SQL Server hiện có trong schema `dbo`. Chúng mô tả tên bảng, tên cột, kiểu dữ liệu, khóa chính và quan hệ để repository truy vấn bằng Sequelize. Model không tự tạo hoặc sửa bảng.

## Luồng kết nối

`server.js` nạp `.env` và xác thực Sequelize khi khởi động. `config/sequelize.js` tạo Sequelize instance dùng driver `tedious`; pool này được dùng chung cho repository, health check và session store. Không còn `mssql` pool riêng.

## Quy tắc an toàn

- Không gọi `sequelize.sync()` hoặc `sync({ alter: true })` trên database hiện có. Schema được quản lý bằng script SQL trong `backend/sql/` và chạy thủ công bằng SSMS.
- Mặc định tắt timestamps tự động. Một số model bật/tắt riêng theo cột thật; không giả định Sequelize được phép tự thêm `createdAt`/`updatedAt`.
- Associations dùng `constraints: false`: chúng hỗ trợ JOIN/điều hướng model, không tạo lại FK. SQL Server vẫn xác thực FK, CHECK constraint và unique index.
- FK kép của `jobs(company_id,recruiter_id)` và `(applications.candidate_id,cv_id)` không được biểu diễn đầy đủ bằng một association đơn. Giữ các kiểm tra integrity trong service/repository và database.
- `invites.job_key` là computed column `ISNULL(job_id,0)`; không ghi trực tiếp vào cột này.
- `Application` có nhiều `Interview` theo `round_no`; dùng quan hệ `hasMany`, không giả định mỗi application chỉ có một interview.
- SQL đặc thù như lock hint, CTE/window functions và xử lý trigger vẫn có thể nằm trong repository dưới dạng query có tham số qua Sequelize.

## Các model

`models/index.js` khởi tạo models, khai báo associations và xuất registry dùng chung. Mỗi file `*.model.js` ánh xạ một bảng như `User`, `Job`, `Application`, `Interview`, `Message`, `CandidateCv`, `EmailVerification` và `SessionRecord`.
