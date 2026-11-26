const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function getOverviewCounts() {
  const rows = await sequelize.query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM dbo.jobs
       WHERE status = N'active' AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())) AS jobs,
      (SELECT COUNT_BIG(DISTINCT company_id) FROM dbo.jobs
       WHERE status = N'active' AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())) AS companies,
      (SELECT COUNT_BIG(*) FROM dbo.users
       WHERE role = N'candidate' AND status = N'active') AS candidates,
      (SELECT COUNT_BIG(*) FROM dbo.applications) AS applications`, {
    type: QueryTypes.SELECT,
  });
  return rows[0];
}

module.exports = { getOverviewCounts };
