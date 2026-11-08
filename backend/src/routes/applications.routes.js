const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));
const limitApplications = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => `user:${req.session?.userId || req.ip}`,
  message: 'Bạn đã gửi quá nhiều đơn ứng tuyển trong thời gian ngắn. Vui lòng thử lại sau.',
});

const applicationSelect = `
  SELECT a.id, a.job_id AS jobId,
    a.candidate_id AS applicantId, a.candidate_id AS candidateId,
    j.recruiter_id AS recruiterId, u.full_name AS fullName, u.email,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE a.cv_text END AS cv,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE a.cv_id END AS cvId,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE cv.title END AS cvTitle,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE cv.original_name END AS cvFileName,
    CASE WHEN cv.id IS NULL OR a.status = N'withdrawn' OR cv.size_bytes = 0 OR cv.stored_name LIKE N'legacy-missing-%' THEN NULL ELSE CONCAT(N'/api/candidate-content/cvs/', cv.id, N'/file') END AS cvDownloadUrl,
    a.status, a.applied_at AS appliedAt,
    a.updated_at AS updatedAt, i.status AS interviewStatus, j.title AS jobTitle,
    c.id AS companyId, c.name AS companyName, j.location
  FROM dbo.applications AS a
  INNER JOIN dbo.jobs AS j ON j.id = a.job_id
  INNER JOIN dbo.users AS u ON u.id = a.candidate_id
  INNER JOIN dbo.companies AS c ON c.id = j.company_id
  LEFT JOIN dbo.interviews AS i ON i.application_id = a.id
  LEFT JOIN dbo.candidate_cvs AS cv ON cv.id = a.cv_id`;

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
    .query(`
      SELECT
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.applications
          WHERE job_id = @jobId AND candidate_id = @candidateId AND status NOT IN (N'withdrawn', N'employment_ended')
        ) THEN 1 ELSE 0 END AS bit) AS hasApplied,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.applications AS activeApplication
          INNER JOIN dbo.jobs AS activeJob ON activeJob.id = activeApplication.job_id
          WHERE activeApplication.candidate_id = @candidateId
            AND activeApplication.status IN (N'accepted', N'hired')
            AND activeJob.company_id = targetJob.company_id
        ) THEN 1 ELSE 0 END AS bit) AS blockedByActiveEmployment,
        company.name AS companyName
      FROM dbo.jobs AS targetJob
      INNER JOIN dbo.companies AS company ON company.id = targetJob.company_id
      WHERE targetJob.id = @jobId`);
  if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy công việc' });
  return res.json(result.recordset[0]);
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

router.post('/', requireRole('candidate'), limitApplications, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const jobId = String(body.jobId || '');
  const cv = typeof body.cv === 'string' ? body.cv.trim() : '';
  const cvId = body.cvId == null || body.cvId === '' ? null : String(body.cvId);
  if (!validId(jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  if (cv.length > 10000 || (!cv && !cvId)) return res.status(400).json({ error: 'Hãy chọn CV đã tải lên hoặc nhập nội dung giới thiệu (tối đa 10.000 ký tự)' });
  if (cvId && !validId(cvId)) return res.status(400).json({ error: 'Mã CV không hợp lệ' });

  const pool = getPool();
  const job = await pool.request()
    .input('jobId', sql.BigInt, jobId)
    .input('candidateId', sql.BigInt, req.user.id)
    .query(`
    SELECT j.id, j.company_id AS companyId, c.name AS companyName,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.applications AS activeApplication
        INNER JOIN dbo.jobs AS activeJob ON activeJob.id = activeApplication.job_id
        WHERE activeApplication.candidate_id = @candidateId
          AND activeApplication.status IN (N'accepted', N'hired')
          AND activeJob.company_id = j.company_id
      ) THEN 1 ELSE 0 END AS bit) AS blockedByActiveEmployment
    FROM dbo.jobs AS j
    INNER JOIN dbo.companies AS c ON c.id = j.company_id
    INNER JOIN dbo.users AS owner ON owner.id = j.recruiter_id
    WHERE j.id = @jobId AND j.status = N'active'
      AND j.admin_visibility = N'visible' AND c.admin_status = N'active' AND owner.admin_locked = 0
      AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())`);
  if (!job.recordset.length) return res.status(404).json({ error: 'Tin không còn nhận ứng tuyển' });
  if (job.recordset[0].blockedByActiveEmployment) {
    return res.status(409).json({
      error: `Bạn đang hợp tác với ${job.recordset[0].companyName}. Bạn có thể ứng tuyển lại tại công ty này sau khi kết thúc hợp tác.`,
      code: 'ACTIVE_EMPLOYMENT_AT_COMPANY',
    });
  }
  if (cvId) {
    const ownedCv = await pool.request().input('cvId', sql.BigInt, cvId).input('candidateId', sql.BigInt, req.user.id)
      .query(`SELECT 1 AS found FROM dbo.candidate_cvs
        WHERE id = @cvId AND candidate_id = @candidateId AND size_bytes > 0 AND stored_name NOT LIKE N'legacy-missing-%'`);
    if (!ownedCv.recordset.length) return res.status(404).json({ error: 'Không tìm thấy CV của bạn' });
  }

  try {
    const inserted = await pool.request()
      .input('jobId', sql.BigInt, jobId)
      .input('candidateId', sql.BigInt, req.user.id)
      .input('cv', sql.NVarChar(sql.MAX), cv)
      .input('cvId', sql.BigInt, cvId)
      .query(`
        DECLARE @insertedApplication TABLE (id BIGINT);
        INSERT INTO dbo.applications (job_id, candidate_id, cv_text, cv_id, status)
        OUTPUT INSERTED.id INTO @insertedApplication(id)
        VALUES (@jobId, @candidateId, NULLIF(@cv, N''), @cvId, N'applied');
        SELECT id FROM @insertedApplication`);
    const insertedId = inserted.recordset?.[0]?.id;
    const application = await getApplicationById(String(insertedId), req.user);
    return res.status(201).json(application);
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      const reopened = await pool.request()
        .input('jobId', sql.BigInt, jobId)
        .input('candidateId', sql.BigInt, req.user.id)
        .input('cv', sql.NVarChar(sql.MAX), cv)
        .input('cvId', sql.BigInt, cvId)
        .query(`DECLARE @reopenedApplication TABLE (id BIGINT);
          UPDATE dbo.applications
          SET cv_text = NULLIF(@cv, N''), cv_id = @cvId, status = N'applied', applied_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
          OUTPUT INSERTED.id INTO @reopenedApplication(id)
          WHERE job_id = @jobId AND candidate_id = @candidateId AND status IN (N'withdrawn', N'employment_ended');
          SELECT id FROM @reopenedApplication`);
      if (reopened.recordset.length) {
        const application = await getApplicationById(String(reopened.recordset[0].id), req.user);
        return res.status(201).json(application);
      }
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

router.patch('/:id', requireRole('candidate', 'employer', 'admin'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const status = req.body && req.body.status;
  const allowed = ['reviewing', 'hired', 'employment_ended', 'rejected', 'withdrawn'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Trạng thái đơn ứng tuyển không hợp lệ' });
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = new sql.Request(transaction).input('id', sql.BigInt, req.params.id);
    let access = '';
    if (req.user.role === 'candidate') {
      request.input('candidateId', sql.BigInt, req.user.id);
      access = ' AND a.candidate_id = @candidateId';
    } else if (req.user.role === 'employer') {
      request.input('recruiterId', sql.BigInt, req.user.id);
      access = ' AND j.recruiter_id = @recruiterId';
    }
    const found = await request.query(`
      SELECT a.status FROM dbo.applications a WITH (UPDLOCK, ROWLOCK)
      INNER JOIN dbo.jobs j ON j.id = a.job_id
      WHERE a.id = @id${access}`);
    const current = found.recordset[0]?.status;
    if (!current) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển trong phạm vi của bạn' });
    }
    const employerTransitions = {
      reviewing: ['applied', 'reviewing'],
      hired: ['offer_accepted'], // Giữ tương thích hồ sơ cũ.
      employment_ended: ['hired', 'accepted'],
      rejected: ['applied', 'reviewing', 'interview_invited', 'interviewed', 'offered'],
    };
    const candidateTransitions = {
      withdrawn: ['applied', 'reviewing', 'interview_invited', 'interviewed', 'offered', 'offer_accepted'],
    };
    const transitions = req.user.role === 'admin'
      ? [...Object.keys(employerTransitions), ...Object.keys(candidateTransitions)]
      : req.user.role === 'candidate' ? Object.keys(candidateTransitions) : Object.keys(employerTransitions);
    const previousStatuses = req.user.role === 'admin'
      ? [...(employerTransitions[status] || []), ...(candidateTransitions[status] || [])]
      : req.user.role === 'candidate' ? candidateTransitions[status] : employerTransitions[status];
    if (!transitions.includes(status) || !previousStatuses?.includes(current)) {
      await transaction.rollback();
      return res.status(409).json({ error: `Không thể chuyển đơn từ trạng thái ${current} sang ${status}` });
    }
    await new sql.Request(transaction).input('id', sql.BigInt, req.params.id)
      .input('status', sql.NVarChar(30), status)
      .query('UPDATE dbo.applications SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }

  const application = await getApplicationById(req.params.id, req.user);
  return res.json(application);
}));

router.delete('/:id', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('candidateId', sql.BigInt, req.user.id)
    .query(`
      UPDATE dbo.applications SET status = N'withdrawn', updated_at = SYSUTCDATETIME()
      WHERE id = @id AND candidate_id = @candidateId
        AND status IN (N'applied', N'reviewing', N'interview_invited', N'interviewed', N'offered', N'offer_accepted');
      SELECT @@ROWCOUNT AS affected;`);
  if (!result.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy đơn có thể hủy' });
  return res.json({ ok: true });
}));

module.exports = router;
