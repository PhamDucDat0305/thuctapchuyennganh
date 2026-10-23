const express = require('express');
const { getPool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM dbo.jobs
       WHERE status = N'active' AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())) AS jobs,
      (SELECT COUNT_BIG(DISTINCT company_id) FROM dbo.jobs
       WHERE status = N'active' AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())) AS companies,
      (SELECT COUNT_BIG(*) FROM dbo.users
       WHERE role = N'candidate' AND status = N'active') AS candidates,
      (SELECT COUNT_BIG(*) FROM dbo.applications) AS applications`);
  const row = result.recordset[0];
  return res.json({
    jobs: Number(row.jobs),
    companies: Number(row.companies),
    candidates: Number(row.candidates),
    applications: Number(row.applications),
  });
}));

module.exports = router;
