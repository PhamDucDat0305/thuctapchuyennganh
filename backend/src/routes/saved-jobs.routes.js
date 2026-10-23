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
  const request = getPool().request()
    .input('candidateId', sql.BigInt, req.user.id)
    .input('jobId', sql.BigInt, req.params.jobId);
  const result = await request.query(`
    IF NOT EXISTS (
      SELECT 1 FROM dbo.jobs
      WHERE id = @jobId AND status = N'active'
        AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())
    )
    BEGIN
      SELECT CAST(0 AS bit) AS jobAvailable;
    END
    ELSE IF EXISTS (
      SELECT 1 FROM dbo.saved_jobs WITH (UPDLOCK, HOLDLOCK)
      WHERE candidate_id = @candidateId AND job_id = @jobId
    )
    BEGIN
      DELETE FROM dbo.saved_jobs WHERE candidate_id = @candidateId AND job_id = @jobId;
      SELECT CAST(0 AS bit) AS saved, CAST(1 AS bit) AS jobAvailable;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.saved_jobs (candidate_id, job_id) VALUES (@candidateId, @jobId);
      SELECT CAST(1 AS bit) AS saved, CAST(1 AS bit) AS jobAvailable;
    END;`);
  const state = result.recordset[0];
  if (!state.jobAvailable) return res.status(404).json({ error: 'Tin không còn khả dụng để lưu' });
  return res.json({ saved: state.saved });
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
