const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

const applicationSelect = `
  SELECT a.id, a.job_id AS jobId,
    a.candidate_id AS applicantId, a.candidate_id AS candidateId,
    j.recruiter_id AS recruiterId, u.full_name AS fullName, u.email,
    a.cv_text AS cv, a.status, a.applied_at AS appliedAt,
    a.updated_at AS updatedAt, j.title AS jobTitle,
    c.name AS companyName, j.location
  FROM dbo.applications AS a
  INNER JOIN dbo.jobs AS j ON j.id = a.job_id
  INNER JOIN dbo.users AS u ON u.id = a.candidate_id
  INNER JOIN dbo.companies AS c ON c.id = j.company_id`;

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function bindId(request, name, value) {
  return request.input(name, sql.BigInt, value);
}

async function getApplicationById(id, access) {
  const request = getPool().request();
  bindId(request, 'id', id);
  let accessSql = '';
  if (access.role === 'candidate') {
    bindId(request, 'candidateId', access.id);
    accessSql = ' AND a.candidate_id = @candidateId';
  } else if (access.role === 'employer') {
    bindId(request, 'recruiterId', access.id);
    accessSql = ' AND j.recruiter_id = @recruiterId';
  }
  const result = await request.query(`${applicationSelect} WHERE a.id = @id${accessSql}`);
  return result.recordset[0] || null;
}

// Lists only the current user's applications, employer-owned applications, or
// all applications for an administrator. Identity always comes from the session.
router.get('/', asyncHandler(async (req, res) => {
  const request = getPool().request();
  let where = '';
  if (req.user.role === 'candidate') {
    bindId(request, 'candidateId', req.user.id);
    where = ' WHERE a.candidate_id = @candidateId';
  } else if (req.user.role === 'employer') {
    bindId(request, 'recruiterId', req.user.id);
    where = ' WHERE j.recruiter_id = @recruiterId';
  }
  const result = await request.query(`${applicationSelect}${where} ORDER BY a.applied_at DESC, a.id DESC`);
  return res.json(result.recordset);
}));

router.get('/check/:jobId', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const result = await getPool().request()
    .input('jobId', sql.BigInt, req.params.jobId)
    .input('candidateId', sql.BigInt, req.user.id)
    .query('SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.applications WHERE job_id = @jobId AND candidate_id = @candidateId) THEN 1 ELSE 0 END AS bit) AS hasApplied');
  return res.json({ hasApplied: result.recordset[0].hasApplied });
}));

router.get('/job/:jobId', requireRole('employer', 'admin'), asyncHandler(async (req, res) => {
  if (!validId(req.params.jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const request = getPool().request().input('jobId', sql.BigInt, req.params.jobId);
  let access = '';
  if (req.user.role === 'employer') {
    bindId(request, 'recruiterId', req.user.id);
    access = ' AND j.recruiter_id = @recruiterId';
  }
  const result = await request.query(`${applicationSelect} WHERE a.job_id = @jobId${access} ORDER BY a.applied_at DESC, a.id DESC`);
  return res.json(result.recordset);
}));

router.post('/', requireRole('candidate'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const jobId = String(body.jobId || '');
  const cv = typeof body.cv === 'string' ? body.cv.trim() : '';
  if (!validId(jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  if (!cv || cv.length > 10000) return res.status(400).json({ error: 'Nội dung giới thiệu/CV là bắt buộc (tối đa 10.000 ký tự)' });

  const pool = getPool();
  const job = await pool.request().input('jobId', sql.BigInt, jobId).query(`
    SELECT id FROM dbo.jobs
    WHERE id = @jobId AND status = N'active'
      AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())`);
  if (!job.recordset.length) return res.status(404).json({ error: 'Tin không còn nhận ứng tuyển' });

  try {
    const inserted = await pool.request()
      .input('jobId', sql.BigInt, jobId)
      .input('candidateId', sql.BigInt, req.user.id)
      .input('cv', sql.NVarChar(sql.MAX), cv)
      .query(`
        INSERT INTO dbo.applications (job_id, candidate_id, cv_text, status)
        OUTPUT INSERTED.id AS id
        VALUES (@jobId, @candidateId, @cv, N'applied')`);
    const application = await getApplicationById(String(inserted.recordset[0].id), req.user);
    return res.status(201).json(application);
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ error: 'Bạn đã ứng tuyển tin này rồi' });
    }
    throw error;
  }
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const application = await getApplicationById(req.params.id, req.user);
  if (!application) return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển' });
  return res.json(application);
}));

router.patch('/:id', requireRole('employer', 'admin'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const status = req.body && req.body.status;
  const allowed = ['interview_scheduled', 'accepted', 'rejected', 'failed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Trạng thái đơn ứng tuyển không hợp lệ' });

  const request = getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('status', sql.NVarChar(30), status);
  let access = '';
  if (req.user.role === 'employer') {
    bindId(request, 'recruiterId', req.user.id);
    access = ' AND EXISTS (SELECT 1 FROM dbo.jobs AS j WHERE j.id = a.job_id AND j.recruiter_id = @recruiterId)';
  }
  const updated = await request.query(`
    UPDATE a SET status = @status, updated_at = SYSUTCDATETIME()
    FROM dbo.applications AS a
    WHERE a.id = @id${access};
    SELECT @@ROWCOUNT AS affected;`);
  if (!updated.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển trong tin của bạn' });

  const application = await getApplicationById(req.params.id, req.user);
  return res.json(application);
}));

router.delete('/:id', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('candidateId', sql.BigInt, req.user.id)
    .query(`
      DELETE FROM dbo.applications
      OUTPUT DELETED.id AS id
      WHERE id = @id AND candidate_id = @candidateId
        AND status IN (N'applied', N'interview_scheduled')`);
  if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy đơn có thể hủy' });
  return res.json({ ok: true });
}));

module.exports = router;
