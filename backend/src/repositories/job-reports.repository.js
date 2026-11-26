const { literal, Op, QueryTypes } = require('sequelize');
const { sequelize, Job, Company, User } = require('../models');

async function findReportableJob(jobId) {
  return Job.findOne({
    attributes: ['id'],
    where: {
      id: jobId,
      status: 'active',
      adminVisibility: 'visible',
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: literal('SYSUTCDATETIME()') } },
      ],
    },
    include: [
      { model: Company, as: 'company', attributes: [], required: true, where: { adminStatus: 'active' } },
      { model: User, as: 'recruiter', attributes: [], required: true, where: { adminLocked: false } },
    ],
  });
}

async function create(values) {
  const rows = await sequelize.query(`
    INSERT INTO dbo.job_reports (job_id, reporter_id, full_name, phone, address, email, content)
    VALUES (:jobId, :reporterId, :fullName, :phone, :address, :email, :content);
    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS id`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

module.exports = { findReportableJob, create };
