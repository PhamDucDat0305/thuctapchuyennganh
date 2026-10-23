# Tình trạng kiểm thử

## Test suite trong repository

- Không tìm thấy test file/spec hoặc test framework.
- `backend/package.json` chỉ khai báo scripts `start` và `dev`; không có `test`, `build`, `lint`.
- Không thấy frontend test harness, SQL integration test hoặc CI workflow.

## Lệnh thực sự chạy trong audit

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `node --version` | `v24.19.0`. |
| `npm --version` | `11.17.0`. |
| `npm run` trong `backend/` | Liệt kê `start` và `dev`; không có build/test. |
| `npm ls --depth=0` trong `backend/` | PASS; các direct dependencies/dev dependency khai báo được liệt kê. |
| `node --check` trên `backend/src/**/*.js` | PASS cho 23 file JavaScript. |
| `node --check` trên `js/*.js` | PASS cho 7 file JavaScript. |
| `npm run` ở root | Không áp dụng: root không có `package.json` (npm trả ENOENT). |

Các syntax check chỉ kiểm tra cú pháp, không chạy handler, browser hoặc SQL.

## Chưa chạy/chưa xác minh

- Không chạy `npm ci`, server, browser, request API hay `npm test` (không có script test).
- Không kết nối SQL Server, chạy SQLCMD, đọc schema runtime, xem trigger/index, chạy migration hoặc seed.
- Không chạy linter, security scanner, coverage, HTML validator, load test hoặc benchmark.
- Không xác minh CORS/cookie trong trình duyệt.
- Trước đó người dùng báo thành công một số test tay: đăng ký/`/me`/logout, cập nhật trạng thái ứng tuyển, đặt lịch phỏng vấn, lưu hồ sơ công ty, job view và profile views. Đây là báo cáo trao đổi chứ không phải test log độc lập trong audit này. Với messages, đã có log lỗi schema/session và chưa thấy xác nhận hoạt động sau sửa.

## Test nên bổ sung

### Backend unit/integration

- Auth: register roles, duplicate race, password hashing, bad login, inactive account, session regenerate/destroy, password change.
- Authorization/BOLA: candidate chỉ thấy/sửa dữ liệu mình; employer chỉ job/application/company của mình; hidden profile không truy cập ngoài policy; admin provisioning.
- Jobs: validate body, SQL params, active/expired filters, view counting with trigger and duplicate/bot semantics.
- Applications: duplicate concurrent apply, owner status update, cannot mutate foreign job, withdraw statuses.
- Interviews: invalid leap dates/time, owner enforcement, transaction rollback, one interview/application, legacy nullable rows.
- Messages: recipient policy, cursor pagination, read state, 50-row limit, huge history performance.
- Invites/profile views/saved jobs: role, duplicate concurrency, UTC boundary, status transitions.
- Error handling: malformed JSON, SQL schema error safe response, no stack exposure.

### Frontend

- Register/login/session refresh/logout with cookies; CORS both `localhost` and `127.0.0.1`.
- Form validation and API error persistence.
- Browser XSS tests against job/profile/message text using harmless encoded payloads.
- Candidate/employer navigation and role restrictions.
- Regression screenshots/responsive layouts after data loads/fails.

### Database

- Fresh baseline creation test and upgrade test from actual legacy schema snapshots.
- Validate FK/unique/check/default/index and migration re-run idempotence on disposable SQL Server.
- Query plans/IO for job search, application lists, candidate discovery, conversations.
- Backup/restore and retention test with synthetic messages only.
