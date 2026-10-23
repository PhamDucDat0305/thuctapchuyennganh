const express = require('express');
const { sql, getPool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const jobSelect = `
  SELECT
    j.id,
    j.title,
    j.description,
    j.requirements,
    j.benefits,
    j.category,
    j.location,
    j.salary_display AS salary,
    j.job_type AS type,
    j.experience,
    j.status,
    j.views,
    j.created_at AS createdAt,
    j.recruiter_id AS createdBy,
    j.recruiter_id AS recruiterId,
    c.name AS companyName
  FROM dbo.jobs AS j
  INNER JOIN dbo.companies AS c ON c.id = j.company_id`;

// Public job board: return active, non-expired jobs for the existing list UI.
router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request().query(`
    ${jobSelect}
    WHERE j.status = N'active'
      AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())
    ORDER BY j.created_at DESC, j.id DESC`);

  res.json(result.recordset);
}));

// Count each detail-page visit atomically; the employer's own visits do not count.
router.post('/:id/view', asyncHandler(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  }

  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('viewerId', sql.BigInt, req.session?.userId || null)
    .query(`
      DECLARE @updatedJobs TABLE (job_id BIGINT NOT NULL);
      UPDATE dbo.jobs
      SET views = ISNULL(views, 0) + 1
      OUTPUT inserted.id INTO @updatedJobs(job_id)
      WHERE id = @id
        AND status = N'active'
        AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())
        AND (@viewerId IS NULL OR recruiter_id <> @viewerId);

      SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM @updatedJobs) THEN 1 ELSE 0 END AS bit) AS counted,
        (SELECT views FROM dbo.jobs WHERE id = @id) AS views`);

  const row = result.recordset[0];
  if (!row?.counted) return res.json({ counted: false });
  return res.json({ counted: true, views: Number(row.views) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  }

  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .query(`
      ${jobSelect}
      WHERE j.id = @id
        AND j.status = N'active'
        AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())`);

  if (result.recordset.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy việc làm' });
  }

  return res.json(result.recordset[0]);
}));

module.exports = router;
