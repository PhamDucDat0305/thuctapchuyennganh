const { Op, literal, QueryTypes } = require('sequelize');
const { sequelize, Job, Company, User } = require('../models');

const publicJobIncludes = [
  { model: Company, as: 'company', attributes: ['id', 'name'], required: true, where: { adminStatus: 'active' } },
  { model: User, as: 'recruiter', attributes: [], required: true, where: { adminLocked: false } },
];

const publicJobWhere = {
  status: 'active',
  adminVisibility: 'visible',
  [Op.or]: [
    { expiresAt: null },
    { expiresAt: { [Op.gt]: literal('SYSUTCDATETIME()') } },
  ],
};

const publicJobAttributes = [
  'id', 'title', 'description', 'requirements', 'benefits', 'category', 'location',
  'salaryDisplay', 'salaryMin', 'salaryMax', 'jobType', 'experience', 'status',
  'views', 'createdAt', 'expiresAt', 'recruiterId',
];

function mapJob(row) {
  const company = row.company;
  const value = (item) => item == null ? null : Number(item);
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    category: row.category,
    location: row.location,
    salary: row.salaryDisplay,
    salaryMin: value(row.salaryMin),
    salaryMax: value(row.salaryMax),
    type: row.jobType,
    experience: row.experience,
    status: row.status,
    views: Number(row.views),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    createdBy: Number(row.recruiterId),
    recruiterId: Number(row.recruiterId),
    companyId: Number(company.id),
    companyName: company.name,
  };
}

async function listPublicJobs() {
  const rows = await Job.findAll({
    attributes: publicJobAttributes,
    where: publicJobWhere,
    include: publicJobIncludes,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return rows.map(mapJob);
}

async function findPublicJobById(id) {
  const row = await Job.findOne({
    attributes: publicJobAttributes,
    where: { ...publicJobWhere, id },
    include: publicJobIncludes,
  });
  return row ? mapJob(row) : null;
}

async function countPublicView(id, viewerId) {
  const rows = await sequelize.query(`
    DECLARE @updatedJobs TABLE (job_id BIGINT NOT NULL);
    UPDATE dbo.jobs
    SET views = ISNULL(views, 0) + 1
    OUTPUT inserted.id INTO @updatedJobs(job_id)
    WHERE id = :id
      AND status = N'active'
      AND admin_visibility = N'visible'
      AND EXISTS (SELECT 1 FROM dbo.companies c WHERE c.id = dbo.jobs.company_id AND c.admin_status = N'active')
      AND EXISTS (SELECT 1 FROM dbo.users u WHERE u.id = dbo.jobs.recruiter_id AND u.admin_locked = 0)
      AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME())
      AND (:viewerId IS NULL OR recruiter_id <> :viewerId);

    SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM @updatedJobs) THEN 1 ELSE 0 END AS bit) AS counted,
      (SELECT views FROM dbo.jobs WHERE id = :id) AS views`, {
    replacements: { id, viewerId },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

module.exports = { listPublicJobs, findPublicJobById, countPublicView };
