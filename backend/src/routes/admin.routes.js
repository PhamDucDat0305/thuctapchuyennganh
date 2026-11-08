const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

function positiveId(value) { return /^[1-9]\d*$/.test(String(value)); }
function queryText(value) { return typeof value === 'string' ? value.trim().slice(0, 100) : ''; }
function pageParams(req) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}
function requireReason(req, res) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason || reason.length > 500) {
    res.status(400).json({ error: 'Lý do bắt buộc, tối đa 500 ký tự' });
    return null;
  }
  return reason;
}
async function audit(transaction, req, data) {
  await transaction.request()
    .input('adminId', sql.BigInt, req.user.id)
    .input('action', sql.NVarChar(80), data.action)
    .input('targetType', sql.NVarChar(40), data.targetType)
    .input('targetId', sql.BigInt, data.targetId ?? null)
    .input('reason', sql.NVarChar(500), data.reason ?? null)
    .input('ip', sql.NVarChar(45), String(req.ip || '').slice(0, 45) || null)
    .input('metadata', sql.NVarChar(sql.MAX), data.metadata ? JSON.stringify(data.metadata) : null)
    .query(`INSERT INTO dbo.admin_audit_logs(admin_id, action, target_type, target_id, reason, ip_address, metadata_json)
      VALUES(@adminId, @action, @targetType, @targetId, @reason, @ip, @metadata)`);
}
async function auditRead(req, action, targetType) {
  await getPool().request()
    .input('adminId', sql.BigInt, req.user.id)
    .input('action', sql.NVarChar(80), action)
    .input('targetType', sql.NVarChar(40), targetType)
    .input('ip', sql.NVarChar(45), String(req.ip || '').slice(0, 45) || null)
    .query(`INSERT INTO dbo.admin_audit_logs(admin_id, action, target_type, ip_address)
      VALUES(@adminId, @action, @targetType, @ip)`);
}
async function transactionFor(req, work) {
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    const value = await work(transaction);
    await transaction.commit();
    return value;
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* original error is more useful */ }
    throw error;
  }
}

router.get('/overview', asyncHandler(async (req, res) => {
  await auditRead(req, 'dashboard.view', 'dashboard');
  const result = await getPool().request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE role = N'candidate' AND status = N'active' AND admin_locked = 0) AS candidates,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE role = N'employer' AND status = N'active' AND admin_locked = 0) AS employers,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE role = N'admin' AND status = N'active') AS admins,
      (SELECT COUNT_BIG(*) FROM dbo.jobs WHERE status = N'active' AND admin_visibility = N'visible'
        AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())) AS activeJobs,
      (SELECT COUNT_BIG(*) FROM dbo.applications) AS applications,
      (SELECT COUNT_BIG(*) FROM dbo.users WHERE created_at >= DATEADD(day, -7, SYSUTCDATETIME())) AS newUsersThisWeek,
      (SELECT COUNT_BIG(*) FROM dbo.jobs WHERE admin_visibility = N'hidden') AS hiddenJobs,
      (SELECT COUNT_BIG(*) FROM dbo.companies WHERE admin_status = N'suspended') AS suspendedCompanies,
      (SELECT COUNT_BIG(*) FROM dbo.job_reports WHERE status = N'new') AS newJobReports`);
  const row = result.recordset[0];
  for (const key of Object.keys(row)) row[key] = Number(row[key]);
  res.json(row);
}));

router.get('/users', asyncHandler(async (req, res) => {
  await auditRead(req, 'users.list', 'users');
  const { page, limit, offset } = pageParams(req);
  const q = queryText(req.query.q);
  const role = ['candidate', 'employer', 'admin'].includes(req.query.role) ? req.query.role : '';
  const request = getPool().request()
    .input('q', sql.NVarChar(202), `%${q.replace(/[\[%_]/g, (c) => `[${c}]`)}%`)
    .input('role', sql.NVarChar(20), role || null)
    .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
  const result = await request.query(`
    SELECT COUNT_BIG(*) OVER() AS total, id, email, full_name AS fullName, role, status,
      admin_locked AS adminLocked, created_at AS createdAt
    FROM dbo.users
    WHERE (@role IS NULL OR role = @role)
      AND (@q = N'%%' OR email LIKE @q OR full_name LIKE @q)
    ORDER BY created_at DESC, id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
  res.json({ items: result.recordset.map((u) => ({ ...u, id: Number(u.id), adminLocked: Boolean(u.adminLocked) })),
    total: Number(result.recordset[0]?.total || 0), page, limit });
}));

router.patch('/users/:id/lock', asyncHandler(async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Mã tài khoản không hợp lệ' });
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Không thể tự khóa tài khoản Admin đang đăng nhập' });
  const reason = requireReason(req, res); if (!reason) return;
  const locked = req.body?.locked;
  if (typeof locked !== 'boolean') return res.status(400).json({ error: 'locked phải là true hoặc false' });
  const outcome = await transactionFor(req, async (tx) => {
    const result = await tx.request().input('id', sql.BigInt, req.params.id)
      .query('SELECT id, role, admin_locked FROM dbo.users WITH (UPDLOCK, ROWLOCK) WHERE id = @id');
    const user = result.recordset[0];
    if (!user) return 'missing';
    if (user.role === 'admin') return 'admin';
    await tx.request().input('id', sql.BigInt, req.params.id).input('locked', sql.Bit, locked)
      .query('UPDATE dbo.users SET admin_locked = @locked WHERE id = @id');
    await audit(tx, req, { action: locked ? 'user.lock' : 'user.unlock', targetType: 'user', targetId: req.params.id, reason });
    return 'ok';
  });
  if (outcome === 'missing') return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  if (outcome === 'admin') return res.status(400).json({ error: 'Không thể khóa tài khoản Admin' });
  res.json({ ok: true, locked });
}));

router.get('/jobs', asyncHandler(async (req, res) => {
  await auditRead(req, 'jobs.list', 'jobs');
  const { page, limit, offset } = pageParams(req); const q = queryText(req.query.q);
  const request = getPool().request().input('q', sql.NVarChar(202), `%${q.replace(/[\[%_]/g, (c) => `[${c}]`)}%`)
    .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
  const result = await request.query(`
    SELECT COUNT_BIG(*) OVER() AS total, j.id, j.title, j.status, j.admin_visibility AS adminVisibility,
      j.created_at AS createdAt, c.id AS companyId, c.name AS companyName, u.email AS employerEmail
    FROM dbo.jobs j INNER JOIN dbo.companies c ON c.id = j.company_id
    INNER JOIN dbo.users u ON u.id = j.recruiter_id
    WHERE (@q = N'%%' OR j.title LIKE @q OR c.name LIKE @q)
    ORDER BY j.created_at DESC, j.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
  res.json({ items: result.recordset.map((x) => ({ ...x, id: Number(x.id), companyId: Number(x.companyId) })),
    total: Number(result.recordset[0]?.total || 0), page, limit });
}));

router.patch('/jobs/:id/visibility', asyncHandler(async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Mã tin không hợp lệ' });
  const reason = requireReason(req, res); if (!reason) return;
  const visibility = req.body?.visibility;
  if (!['visible', 'hidden'].includes(visibility)) return res.status(400).json({ error: 'visibility không hợp lệ' });
  const outcome = await transactionFor(req, async (tx) => {
    const result = await tx.request().input('id', sql.BigInt, req.params.id).query('SELECT id FROM dbo.jobs WITH (UPDLOCK, ROWLOCK) WHERE id = @id');
    if (!result.recordset.length) return false;
    await tx.request().input('id', sql.BigInt, req.params.id).input('visibility', sql.NVarChar(20), visibility)
      .query('UPDATE dbo.jobs SET admin_visibility = @visibility WHERE id = @id');
    await audit(tx, req, { action: `job.${visibility}`, targetType: 'job', targetId: req.params.id, reason }); return true;
  });
  if (!outcome) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
  res.json({ ok: true, visibility });
}));

router.get('/companies', asyncHandler(async (req, res) => {
  await auditRead(req, 'companies.list', 'companies');
  const { page, limit, offset } = pageParams(req); const q = queryText(req.query.q);
  const result = await getPool().request().input('q', sql.NVarChar(202), `%${q.replace(/[\[%_]/g, (c) => `[${c}]`)}%`)
    .input('offset', sql.Int, offset).input('limit', sql.Int, limit).query(`
      SELECT COUNT_BIG(*) OVER() AS total, c.id, c.name, c.industry, c.location,
        c.admin_status AS adminStatus, c.employer_id AS employerId, u.email AS employerEmail
      FROM dbo.companies c INNER JOIN dbo.users u ON u.id = c.employer_id
      WHERE (@q = N'%%' OR c.name LIKE @q OR c.industry LIKE @q OR u.email LIKE @q)
      ORDER BY c.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
  res.json({ items: result.recordset.map((x) => ({ ...x, id: Number(x.id), employerId: Number(x.employerId) })),
    total: Number(result.recordset[0]?.total || 0), page, limit });
}));

router.patch('/companies/:id/status', asyncHandler(async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Mã công ty không hợp lệ' });
  const reason = requireReason(req, res); if (!reason) return;
  const status = req.body?.status;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'status không hợp lệ' });
  const outcome = await transactionFor(req, async (tx) => {
    const result = await tx.request().input('id', sql.BigInt, req.params.id).query('SELECT id FROM dbo.companies WITH (UPDLOCK, ROWLOCK) WHERE id = @id');
    if (!result.recordset.length) return false;
    await tx.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar(20), status)
      .query('UPDATE dbo.companies SET admin_status = @status WHERE id = @id');
    await audit(tx, req, { action: `company.${status}`, targetType: 'company', targetId: req.params.id, reason }); return true;
  });
  if (!outcome) return res.status(404).json({ error: 'Không tìm thấy công ty' });
  res.json({ ok: true, status });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  await auditRead(req, 'audit_logs.view', 'audit_logs');
  const { page, limit, offset } = pageParams(req);
  const result = await getPool().request().input('offset', sql.Int, offset).input('limit', sql.Int, limit).query(`
    SELECT COUNT_BIG(*) OVER() AS total, l.id, l.action, l.target_type AS targetType,
      l.target_id AS targetId, l.reason, l.ip_address AS ipAddress, l.created_at AS createdAt,
      u.email AS adminEmail, l.metadata_json AS metadata
    FROM dbo.admin_audit_logs l INNER JOIN dbo.users u ON u.id = l.admin_id
    ORDER BY l.created_at DESC, l.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
  res.json({ items: result.recordset.map((x) => ({ ...x, id: Number(x.id), targetId: x.targetId == null ? null : Number(x.targetId) })),
    total: Number(result.recordset[0]?.total || 0), page, limit });
}));

router.get('/job-reports', asyncHandler(async (req, res) => {
  await auditRead(req, 'job_reports.list', 'job_reports');
  const status = ['new', 'reviewing', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : null;
  const result = await getPool().request().input('status', sql.NVarChar(20), status).query(`
    SELECT TOP (200) r.id, r.job_id AS jobId, j.title AS jobTitle, c.name AS companyName,
      r.reporter_id AS reporterId, r.full_name AS fullName, r.phone, r.address, r.email,
      r.content, r.status, r.admin_note AS adminNote, r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM dbo.job_reports r
    INNER JOIN dbo.jobs j ON j.id = r.job_id
    INNER JOIN dbo.companies c ON c.id = j.company_id
    WHERE (@status IS NULL OR r.status = @status)
    ORDER BY CASE r.status WHEN N'new' THEN 0 WHEN N'reviewing' THEN 1 ELSE 2 END,
      r.created_at DESC, r.id DESC`);
  res.json(result.recordset.map((x) => ({ ...x, id: Number(x.id), jobId: Number(x.jobId), reporterId: Number(x.reporterId) })));
}));

router.patch('/job-reports/:id', asyncHandler(async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Mã phản ánh không hợp lệ' });
  const status = req.body?.status;
  if (!['reviewing', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái xử lý không hợp lệ' });
  }
  const note = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : '';
  if (note.length > 1000) return res.status(400).json({ error: 'Ghi chú tối đa 1.000 ký tự' });
  const outcome = await transactionFor(req, async (tx) => {
    const found = await tx.request().input('id', sql.BigInt, req.params.id)
      .query('SELECT id FROM dbo.job_reports WITH (UPDLOCK, ROWLOCK) WHERE id = @id');
    if (!found.recordset.length) return false;
    await tx.request().input('id', sql.BigInt, req.params.id)
      .input('status', sql.NVarChar(20), status)
      .input('note', sql.NVarChar(1000), note || null)
      .query(`UPDATE dbo.job_reports SET status = @status, admin_note = @note, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    await audit(tx, req, { action: `job_report.${status}`, targetType: 'job_report', targetId: req.params.id, reason: note || 'Admin cập nhật trạng thái phản ánh' });
    return true;
  });
  if (!outcome) return res.status(404).json({ error: 'Không tìm thấy phản ánh' });
  res.json({ ok: true, status });
}));

module.exports = router;
