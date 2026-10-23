# Tài liệu API

Base path là `/api`; API chạy port mặc định `3000`. Session cookie được gửi bằng `credentials: include`. Route đăng ký ở `backend/src/app.js`; chi tiết handler nằm trong các file dưới đây. Response mô tả theo code, không phải kết quả runtime của lần audit.

## Health, auth, me, public

| Method / route | Handler | Auth | Input/validation | Thành công / lỗi chính |
|---|---|---|---|---|
| `GET /health` | `health.routes.js` `/` | Không | Không | `{status:"ok"}`. |
| `GET /health/db` | `health.routes.js` `/db` | Không | `SELECT 1` | `{status:"ok",database:"connected"}` hoặc 503 `{status:"error",database:"unavailable"}`. |
| `POST /auth/register` | `auth.routes.js` `/register` | Không | `email`, `password` 8–128, `fullName` ≤150, role candidate/employer, phone ≤20; employer cần `companyName` ≤200 | 201 user summary; 400 validate; 409 duplicate email; tạo user/profile-or-company/session trong transaction. |
| `POST /auth/login` | `/login` | Không | email/password; Argon2 verify | 200 user; 400 input; 401 sai credentials đồng nhất; 403 tài khoản không active. |
| `POST /auth/logout` | `/logout` | Không bắt buộc | Hủy session nếu có | `{ok:true}`; cookie bị clear. |
| `GET /me` | `me.routes.js` `/` | Session | Không | `{user}`; 401 nếu không auth/session invalid. |
| `PATCH /me/profile` | `/profile` | Session | Whitelist `fullName,email,phone,searchStatus,twoFactorEnabled,title,location,experience,skills`; giới hạn theo handler | `{user}`; 400 validate/no field; 403 fields nghề nghiệp ngoài candidate; 409 email trùng. |
| `POST /me/password` | `/password` | Session | `currentPassword`, `newPassword` 8–128 | `{ok:true}`; 400 password cũ/sai input. |
| `GET /stats` | `stats.routes.js` `/` | Không | Không | Aggregate job/company/candidate/application counts. |
| `GET /jobs` | `jobs.routes.js` `/` | Không | Không | Array active non-expired jobs; không có server pagination/query filter trong handler. |
| `GET /jobs/:id` | `jobs.routes.js` `/:id` | Không | Numeric ID | Job active/non-expired; 400 ID invalid, 404 missing. |
| `POST /jobs/:id/view` | `jobs.routes.js` | Không bắt buộc | ID; viewer session optional | `{counted,views}`; lỗi 400 ID. Uses `OUTPUT ... INTO` để tương thích trigger trên `jobs`. |

## Employer jobs, company, users

| Method / route | Auth/ownership | Input/logic | Thành công / lỗi |
|---|---|---|---|
| `GET /employer/jobs` | Employer | Chỉ `req.user.id` | Array việc của employer. |
| `GET /employer/jobs/:id` | Employer + recruiter ownership | ID | Job hoặc 400/404. |
| `POST /employer/jobs` | Employer | Title/description/requirements/benefits/category/location/salary/type/experience; type full-time/part-time | 201 job active; validate 400, thiếu company 409. |
| `PATCH /employer/jobs/:id` | Employer + owner | Partial fields whitelist | Job cập nhật; 400/404. |
| `PATCH /employer/jobs/:id/close` | Employer + owner | ID | `{ok:true}`; 404 nếu không còn job đang mở. |
| `GET /employer/company` | Employer | Lấy company theo session ID | Company/null. |
| `POST /employer/company` | Employer | Validate fields; create/update tùy tồn tại | 201 company. |
| `PUT /employer/company` | Employer | Partial company fields whitelist | Company; 400/404. |
| `GET /users/candidates` | Employer/admin | Candidate active, search_status=1 | Mảng profile; không pagination. |
| `GET /users/:id` | Candidate/employer/admin | ID; email/phone được CASE che nếu không self hoặc recruiter đã có application | Profile/404. Không kiểm tra search_status trước khi trả profile fields; xem ISSUE-001. |

## Applications và interview

| Method / route | Auth/ownership | Input/logic | Thành công / lỗi |
|---|---|---|---|
| `GET /applications` | Candidate/employer/admin | Candidate chỉ bản thân; employer job mình; admin toàn bộ | Array, không pagination. |
| `GET /applications/check/:jobId` | Candidate | Job ID | `{hasApplied}`; 400 ID. |
| `GET /applications/job/:jobId` | Employer owner/admin | Job ID; employer có recruiter filter | Array; 400 ID. |
| `POST /applications` | Candidate | `jobId`, `cv` required ≤10k; job active/non-expired | 201 application; 400,404,409 duplicate. |
| `GET /applications/:id` | Candidate/employer/admin | Candidate owner/employer recruiter filter; admin unfiltered | Application hoặc 400/404. |
| `PATCH /applications/:id` | Employer owner/admin | status: interview_scheduled/accepted/rejected/failed | Application; 400/404. |
| `DELETE /applications/:id` | Candidate owner | Chỉ status applied/interview_scheduled | `{ok:true}` hoặc 404. |
| `GET /interviews` | Candidate/employer/admin | Candidate/employer được lọc qua application/job | Array sắp theo lịch. |
| `GET /interviews/application/:applicationId` | Candidate/employer/admin | Ownership filter | Interview hoặc null; 400 ID. |
| `POST /interviews` | Employer | Application ID, strict date, HH:mm, online/offline, notes ≤2k | 201 interview; 400/404; transaction cập nhật status application. |

## Saved jobs, messages, invites, profile views

| Method / route | Auth | Input/logic | Thành công / lỗi |
|---|---|---|---|
| `GET /saved-jobs` | Candidate | Session candidate ID | Array. |
| `GET /saved-jobs/check/:jobId` | Candidate | Numeric job ID | `{saved}`. |
| `POST /saved-jobs/:jobId/toggle` | Candidate | Chỉ job active/non-expired | `{saved}`; 404 unavailable; serialize toggle bằng locks. |
| `DELETE /saved-jobs/:jobId` | Candidate | Candidate ID từ session | `{saved:false}`. |
| `GET /messages/conversations` | Candidate/employer | User ID session | Last message/unread count theo contact; hiện aggregate toàn history. |
| `GET /messages/conversation/:contactId` | Candidate/employer | Cursor `beforeId` và `beforeTimestamp` phải đi cùng nhau; page 50 | `{messages,hasMore,nextCursor}`; 400 cursor invalid. |
| `POST /messages` | Candidate/employer | receiverId, content 1–2000 | 201 message; 400 self/invalid; 404 receiver unavailable. |
| `PATCH /messages/read/:contactId` | Candidate/employer | Contact ID | `{ok,affected}`; đánh dấu message đến user là đã đọc. |
| `GET /invites` | Candidate | Session candidate ID | Array lời mời. |
| `POST /invites` | Employer | candidateId, optional jobId owned, message ≤1000 | 201 invite; 400/404/409 pending duplicate. Race duplicate chưa được DB constraint ngăn. |
| `PATCH /invites/:id/status` | Candidate owner | `accepted` hoặc `rejected`, chỉ pending | `{id,status}`; 400/404/409. |
| `GET /profile-views` | Candidate | Candidate từ session | Array lượt employer/company đã xem. |
| `POST /profile-views` | Employer | `candidateId` | `{recorded:true}`; 400/404; upsert một lượt employer/candidate/ngày UTC. |

## Ví dụ dữ liệu giả

```http
POST /api/auth/login
Content-Type: application/json

{"email":"demo.candidate@example.test","password":"ExamplePassword123"}
```

```json
{"user":{"id":101,"email":"demo.candidate@example.test","fullName":"Demo Candidate","role":"candidate"}}
```

Response minh họa được suy ra từ code; không phải response ghi nhận từ server đang chạy.

## Lỗi chung

- 400 validation/JSON malformed; 401 unauthenticated/credentials invalid; 403 role/status; 404 resource/ownership; 409 duplicate/conflict.
- SQL error 207/208 trả 503 thông báo schema mismatch.
- Lỗi khác 500 `{error:"Lỗi máy chủ"}`; stack/SQL details nằm trong log server.
- Không thấy Swagger/OpenAPI hoặc API contract tự sinh.
