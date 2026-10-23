const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

router.get('/', requireRole('candidate'), asyncHandler(async (req, res) => {
  const result = await getPool().request()
    .input('candidateId', sql.BigInt, req.user.id)
    .query(`
      SELECT pv.id, pv.employer_id AS employerId, pv.candidate_id AS candidateId,
        pv.viewed_at AS viewedAt, c.name AS companyName, c.industry
      FROM dbo.profile_views AS pv
      INNER JOIN dbo.users AS employer ON employer.id = pv.employer_id
      LEFT JOIN dbo.companies AS c ON c.employer_id = pv.employer_id
      WHERE pv.candidate_id = @candidateId
      ORDER BY pv.viewed_at DESC, pv.id DESC`);
  return res.json(result.recordset);
}));

router.post('/', requireRole('employer'), asyncHandler(async (req, res) => {
  const candidateId = String(req.body?.candidateId ?? '');
  if (!validId(candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  if (Number(candidateId) === req.user.id) return res.status(400).json({ error: 'Không thể xem hồ sơ của chính mình' });

  const pool = getPool();
  const candidate = await pool.request().input('candidateId', sql.BigInt, candidateId)
    .query(`SELECT id FROM dbo.users WHERE id = @candidateId AND role = N'candidate' AND status = N'active'`);
  if (!candidate.recordset.length) return res.status(404).json({ error: 'Không tìm thấy ứng viên đang hoạt động' });

  await pool.request()
    .input('employerId', sql.BigInt, req.user.id)
    .input('candidateId', sql.BigInt, candidateId)
    .query(`
      SET XACT_ABORT ON;
      DECLARE @today DATE = CONVERT(date, SYSUTCDATETIME());
      BEGIN TRANSACTION;
      IF EXISTS (
        SELECT 1 FROM dbo.profile_views WITH (UPDLOCK, HOLDLOCK)
        WHERE employer_id = @employerId AND candidate_id = @candidateId AND viewed_on = @today
      )
      BEGIN
        UPDATE dbo.profile_views SET viewed_at = SYSUTCDATETIME()
        WHERE employer_id = @employerId AND candidate_id = @candidateId AND viewed_on = @today;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.profile_views (employer_id, candidate_id, viewed_on)
        VALUES (@employerId, @candidateId, @today);
      END;
      COMMIT TRANSACTION;`);
  return res.json({ recorded: true });
}));

module.exports = router;
