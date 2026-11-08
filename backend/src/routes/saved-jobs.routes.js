const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate'));

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request().input('candidateId', sql.BigInt, req.user.id).query(`
    SELECT candidate_id AS userId, job_id AS jobId, saved_at AS savedAt
    FROM dbo.saved_jobs
    WHERE candidate_id = @candidateId
    ORDER BY saved_at DESC, job_id DESC`);
  return res.json(result.recordset);
}));

router.get('/check/:jobId', asyncHandler(async (req, res) => {
  if (!validId(req.params.jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const result = await getPool().request()
    .input('candidateId', sql.BigInt, req.user.id)
    .input('jobId', sql.BigInt, req.params.jobId)
    .query(`SELECT CAST(CASE WHEN EXISTS (
      SELECT 1 FROM dbo.saved_jobs WHERE candidate_id = @candidateId AND job_id = @jobId
    ) THEN 1 ELSE 0 END AS bit) AS saved`);
  return res.json({ saved: result.recordset[0].saved });
}));

router.post('/:jobId/toggle', asyncHandler(async (req, res) => {
  if (!validId(req.params.jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const transaction = new sql.Transaction(getPool());
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = new sql.Request(transaction)
      .input('candidateId', sql.BigInt, req.user.id)
      .input('jobId', sql.BigInt, req.params.jobId);
    const existing = await request.query(`SELECT 1 AS found FROM dbo.saved_jobs WITH (UPDLOCK, HOLDLOCK)
      WHERE candidate_id = @candidateId AND job_id = @jobId`);
    if (existing.recordset.length) {
      await new sql.Request(transaction).input('candidateId', sql.BigInt, req.user.id).input('jobId', sql.BigInt, req.params.jobId)
        .query('DELETE FROM dbo.saved_jobs WHERE candidate_id = @candidateId AND job_id = @jobId');
      await transaction.commit();
      return res.json({ saved: false });
    }
    const available = await new sql.Request(transaction).input('jobId', sql.BigInt, req.params.jobId).query(`
      SELECT j.id FROM dbo.jobs j
      INNER JOIN dbo.companies c ON c.id = j.company_id
      INNER JOIN dbo.users owner ON owner.id = j.recruiter_id
      WHERE j.id = @jobId AND j.status = N'active' AND j.admin_visibility = N'visible'
        AND c.admin_status = N'active' AND owner.admin_locked = 0
        AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())`);
    if (!available.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Tin không còn khả dụng để lưu' });
    }
    await new sql.Request(transaction).input('candidateId', sql.BigInt, req.user.id).input('jobId', sql.BigInt, req.params.jobId)
      .query('INSERT INTO dbo.saved_jobs (candidate_id, job_id) VALUES (@candidateId, @jobId)');
    await transaction.commit();
    return res.json({ saved: true });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}));

router.delete('/:jobId', asyncHandler(async (req, res) => {
  if (!validId(req.params.jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  await getPool().request()
    .input('candidateId', sql.BigInt, req.user.id)
    .input('jobId', sql.BigInt, req.params.jobId)
    .query('DELETE FROM dbo.saved_jobs WHERE candidate_id = @candidateId AND job_id = @jobId');
  return res.json({ saved: false });
}));

module.exports = router;
