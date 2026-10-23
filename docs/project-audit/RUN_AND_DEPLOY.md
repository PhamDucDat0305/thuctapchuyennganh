# Chạy và triển khai

## Điều kiện

- Node.js/npm; runtime quan sát trong audit là Node `24.19.0`, npm `11.17.0`.
- SQL Server và database `job_viet` (tên ví dụ ở `backend/.env.example`), SQL login được cấp quyền cần thiết.
- Frontend static server như Live Server; frontend gọi API port `3000` trên cùng hostname. Mặc định CORS cho một số origin localhost 5500/5501; cấu hình `FRONTEND_ORIGINS` cho môi trường thực tế.
- Không tìm thấy DDL baseline `users/jobs/companies`; cần có schema lõi trước khi các migrations trong repo chạy được.

## Cài dependency

Lệnh suy ra từ lockfile; chưa chạy `npm ci` trong audit:

```powershell
Set-Location D:\DH52300430\backend
npm ci
```

Audit đã chạy `npm ls --depth=0` từ `backend/` và dependency khai báo được liệt kê đầy đủ.

## Cấu hình môi trường

Sao chép `backend/.env.example` thành `backend/.env` (file `.env` bị ignore), rồi tự điền giá trị local:

```text
PORT=3000
NODE_ENV=development
FRONTEND_ORIGINS=http://localhost:5500
SESSION_SECRET=<chuỗi ngẫu nhiên dài, riêng cho môi trường>
DB_SERVER=<SQL Server host>
DB_PORT=1433
DB_INSTANCE=
DB_NAME=job_viet
DB_USER=<SQL login>
DB_PASSWORD=<SQL password>
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

Named instance dùng `DB_INSTANCE`; code khi đó không đặt `DB_PORT`. Các placeholder trên không phải credentials thật. Không commit `.env`.

## Database

1. Dựng/đối chiếu base tables `dbo.users`, `dbo.companies`, `dbo.jobs` từ schema thực của project/database hiện có. Source hiện không có script tạo ban đầu cho chúng.
2. Sao lưu database và kiểm tra mỗi migration với schema/dữ liệu staging trước.
3. Các script là SQL Server/SSMS có `GO`; chạy từng script theo thứ tự 001–011 sau khi xác nhận tiền điều kiện và schema lịch sử. 003 phụ thuộc `applications`; 004/005 phụ thuộc `applications/interviews`; 006 phụ thuộc users/companies; 007–011 phụ thuộc các bảng core và các bảng trước đó.
4. Không chạy tự động trên production dựa vào hướng dẫn này: migrations không có migration ledger/rollback đầy đủ và có nhánh chỉ in “bảng đã tồn tại”. Migration 009 chủ động dừng nếu có message dài hơn 2.000 ký tự.

Không chạy migration trong audit; trạng thái thật phải được người vận hành kiểm tra ở SSMS.

## Chạy local

Terminal backend:

```powershell
Set-Location D:\DH52300430\backend
npm run dev
```

Hoặc production-style process local: `npm start`. Entry point kết nối database trước khi listen; DB connect failure khiến process không mở server. Khi dev, mở static server tại origin nằm trong `FRONTEND_ORIGINS` và cùng hostname với backend. Không mở trực tiếp bằng `file://`.

Health endpoints theo code: `GET http://localhost:3000/api/health` và `/api/health/db`. Chưa gọi chúng trong audit.

## Build/test/deploy

- Không có lệnh build hoặc test khai báo; frontend không bundler.
- Không tìm thấy Dockerfile, compose, CI/CD, hosting config, reverse proxy hoặc production static-server config.
- Trước deploy cần HTTPS, secret riêng, CORS origin chặt, cookie/proxy, rate limits/security headers, backup, baseline migrations, test tự động và quy trình rollback.
- Hướng dẫn deploy cụ thể chưa thể xác nhận vì chưa biết host/domain và không có config triển khai trong repo.

## Lỗi khởi chạy có thể nhận diện từ code

- `.env` thiếu biến bắt buộc DB: `database.js` báo tên biến thiếu.
- SQL Server không kết nối: `server.js` ghi gợi ý kiểm tra `.env`, SQL Server, TCP/IP và quyền login rồi không listen.
- API trả 503 với lỗi SQL 207/208: schema/cột chưa khớp; xem log server và migration tương ứng.
- Cookie không gửi: xác nhận frontend/API cùng hostname, origin nằm trong `FRONTEND_ORIGINS`, dùng web server (không `file://`) và HTTPS/proxy config đúng.

Các trường hợp trên suy ra từ source; ngoài cú pháp, chưa được tái hiện trong audit.
