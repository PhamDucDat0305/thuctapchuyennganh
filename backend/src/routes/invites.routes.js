const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));
const limitInviteSend = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => `user:${req.session?.userId || req.ip}`,
  message: 'Bạn đã gửi quá nhiều lời mời. Vui lòng thử lại sau.',
});

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

const inviteSelect = `
  SELECT i.id, i.employer_id AS employerId, i.candidate_id AS candidateId,
    i.job_id AS jobId, i.message, i.status, i.created_at AS createdAt,
    i.updated_at AS updatedAt, c.name AS companyName, j.title AS jobTitle
  FROM dbo.invites AS i
  LEFT JOIN dbo.companies AS c ON c.employer_id = i.employer_id
  LEFT JOIN dbo.jobs AS j ON j.id = i.job_id`;

router.get('/', requireRole('candidate'), asyncHandler(async (req, res) => {
  const result = await getPool().request()
    .input('candidateId', sql.BigInt, req.user.id)
    .query(`${inviteSelect}
      WHERE i.candidate_id = @candidateId
      ORDER BY i.created_at DESC, i.id DESC`);
  return res.json(result.recordset);
}));

router.post('/', requireRole('employer'), limitInviteSend, asyncHandler(async (req, res) => {
  const candidateId = String(req.body?.candidateId ?? '');
  const jobId = req.body?.jobId == null || req.body.jobId === '' ? null : String(req.body.jobId);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!validId(candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  if (jobId !== null && !validId(jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  if (message.length > 1000) return res.status(400).json({ error: 'Lời nhắn không được vượt quá 1.000 ký tự' });

  const pool = getPool();
  const candidate = await pool.request().input('candidateId', sql.BigInt, candidateId)
    .query(`SELECT id FROM dbo.users WHERE id = @candidateId AND role = N'candidate' AND status = N'active'`);
  if (!candidate.recordset.length) return res.status(404).json({ error: 'Không tìm thấy ứng viên đang hoạt động' });

  if (jobId !== null) {
    const job = await pool.request()
      .input('jobId', sql.BigInt, jobId)
      .input('employerId', sql.BigInt, req.user.id)
      .query(`SELECT id FROM dbo.jobs WHERE id = @jobId AND recruiter_id = @employerId`);
    if (!job.recordset.length) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng của bạn' });
  }

  const duplicate = await pool.request()
    .input('employerId', sql.BigInt, req.user.id)
    .input('candidateId', sql.BigInt, candidateId)
    .input('jobId', sql.BigInt, jobId)
    .query(`SELECT TOP (1) id FROM dbo.invites
      WHERE employer_id = @employerId AND candidate_id = @candidateId
        AND ((job_id = @jobId) OR (job_id IS NULL AND @jobId IS NULL))
        AND status = N'pending'`);
  if (duplicate.recordset.length) return res.status(409).json({ error: 'Bạn đã gửi lời mời đang chờ phản hồi cho ứng viên này' });

  const inserted = await pool.request()
    .input('employerId', sql.BigInt, req.user.id)
    .input('candidateId', sql.BigInt, candidateId)
    .input('jobId', sql.BigInt, jobId)
    .input('message', sql.NVarChar(1000), message || null)
    .query(`
      INSERT INTO dbo.invites (employer_id, candidate_id, job_id, message)
      OUTPUT inserted.id
      VALUES (@employerId, @candidateId, @jobId, @message)`);
  const result = await pool.request().input('id', sql.BigInt, inserted.recordset[0].id)
    .query(`${inviteSelect} WHERE i.id = @id`);
  return res.status(201).json(result.recordset[0]);
}));

router.patch('/:id/status', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã lời mời không hợp lệ' });
  const status = req.body?.status;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái phải là accepted hoặc rejected' });
  }
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('candidateId', sql.BigInt, req.user.id)
    .input('status', sql.NVarChar(20), status)
    .query(`
      UPDATE dbo.invites
      SET status = @status, updated_at = SYSUTCDATETIME()
      WHERE id = @id AND candidate_id = @candidateId AND status = N'pending';
      SELECT @@ROWCOUNT AS affected;`);
  if (!result.recordset[0]?.affected) {
    const existing = await getPool().request()
      .input('id', sql.BigInt, req.params.id)
      .input('candidateId', sql.BigInt, req.user.id)
      .query('SELECT status FROM dbo.invites WHERE id = @id AND candidate_id = @candidateId');
    if (!existing.recordset.length) return res.status(404).json({ error: 'Không tìm thấy lời mời' });
    return res.status(409).json({ error: 'Lời mời này đã được xử lý' });
  }
  return res.json({ id: Number(req.params.id), status });
}));

module.exports = router;
