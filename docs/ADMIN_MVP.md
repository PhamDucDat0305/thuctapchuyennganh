# Admin MVP

## Included

- Admin accounts are created from the backend seed script; public registration remains limited to candidate and employer.
- The Admin dashboard shows account, active job, application, and recent-user totals.
- Admin can search users and lock/unlock candidate or employer accounts, hide/restore job listings, and suspend/restore companies.
- Changes require a reason and are recorded in `dbo.admin_audit_logs`. Data is retained; jobs keep their normal `status` while moderation uses `admin_visibility`.
- Public job listing/detail/view and candidate application endpoints exclude hidden jobs, suspended companies, and locked employers.

## Setup

1. Back up `job_viet` and run [`backend/sql/admin_mvp.sql`](../backend/sql/admin_mvp.sql) and [`backend/sql/job_reports.sql`](../backend/sql/job_reports.sql) in SSMS against that database before restarting the API. These add Admin status columns, the audit table, and the candidate report inbox; they do not rewrite existing job/company/user statuses.
2. Set `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_PASSWORD` in `backend/.env`. Use a unique password of at least 12 characters. Do not commit `.env`.
3. From the `backend` directory, run `npm run admin:seed`. The script creates the Admin user if the email is new, or promotes that existing account and resets its password to the supplied value. It hashes the password with Argon2id.
4. Start the API and sign in through `/auth.html`. Admin is redirected to `/admin/dashboard.html`.

The API requires `dbo.users.status = 'active'` for sign-in and the Admin seed sets it to active. If the database has a CHECK constraint on `users.role` that does not allow `admin`, update that constraint deliberately before seeding; the original core DDL is not in the repository, so this migration does not guess or replace such constraints.

## Admin endpoints

- `GET /api/admin/overview`
- `GET /api/admin/users?q=&role=&page=&limit=` and `PATCH /api/admin/users/:id/lock`
- `GET /api/admin/jobs?q=&page=&limit=` and `PATCH /api/admin/jobs/:id/visibility`
- `GET /api/admin/companies?q=&page=&limit=` and `PATCH /api/admin/companies/:id/status`
- `GET /api/admin/audit-logs?page=&limit=`
- `GET /api/admin/job-reports?status=` and `PATCH /api/admin/job-reports/:id`
- Candidates submit a report with `POST /api/job-reports`; the form captures the contact details and content and associates it with a job.

All endpoints require an authenticated Admin session. Lock/hide/suspend requests require a reason. No hard-delete or pre-publication review was added; new job posts continue to follow the existing active-on-create behavior.
