const { QueryTypes } = require('sequelize');
const { sequelize, Job, Company } = require('../models');

const jobAttributes = [
  'id', 'title', 'description', 'requirements', 'benefits', 'category', 'location',
  'salaryDisplay', 'salaryMin', 'salaryMax', 'jobType', 'experience', 'status',
  'adminVisibility', 'views', 'createdAt', 'expiresAt', 'recruiterId',
];

function mapJob(row) {
  const company = row.company;
  const asNumber = (value) => value == null ? null : Number(value);
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    category: row.category,
    location: row.location,
    salary: row.salaryDisplay,
    salaryMin: asNumber(row.salaryMin),
    salaryMax: asNumber(row.salaryMax),
    type: row.jobType,
    experience: row.experience,
    status: row.status,
    adminVisibility: row.adminVisibility,
    views: Number(row.views),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    createdBy: Number(row.recruiterId),
    recruiterId: Number(row.recruiterId),
    companyId: Number(company.id),
    companyName: company.name,
  };
}

async function listByRecruiter(recruiterId) {
  const rows = await Job.findAll({
    attributes: jobAttributes,
    where: { recruiterId },
    include: [{ model: Company, as: 'company', attributes: ['id', 'name'], required: true }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return rows.map(mapJob);
}

async function findByIdAndRecruiter(id, recruiterId) {
  const row = await Job.findOne({
    attributes: jobAttributes,
    where: { id, recruiterId },
    include: [{ model: Company, as: 'company', attributes: ['id', 'name'], required: true }],
  });
  return row ? mapJob(row) : null;
}

async function findCompanyForRecruiter(employerId) {
  return Company.findOne({ attributes: ['id', 'name'], where: { employerId }, raw: true });
}

async function createJob(values) {
  const rows = await sequelize.query(`
    DECLARE @insertedJob TABLE (id BIGINT NOT NULL);
    INSERT INTO dbo.jobs
      (company_id, recruiter_id, title, description, requirements, benefits,
       category, location, salary_display, salary_min, salary_max, currency,
       job_type, experience, expires_at, status, views)
    OUTPUT INSERTED.id INTO @insertedJob(id)
    VALUES
      (:companyId, :recruiterId, :title, :description, :requirements, :benefits,
       :category, :location, :salary, :salaryMin, :salaryMax, 'VND',
       :type, :experience, :expiresAt, N'active', 0);
    SELECT id FROM @insertedJob`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

const editableColumns = {
  title: 'title',
  description: 'description',
  requirements: 'requirements',
  benefits: 'benefits',
  category: 'category',
  location: 'location',
  salary: 'salary_display',
  salaryMin: 'salary_min',
  salaryMax: 'salary_max',
  type: 'job_type',
  experience: 'experience',
  expiresAt: 'expires_at',
};

async function updateJob(id, recruiterId, values) {
  const keys = Object.keys(values).filter((key) => editableColumns[key]);
  const assignments = keys.map((key) => `[${editableColumns[key]}] = :${key}`);
  const rows = await sequelize.query(`
    UPDATE dbo.jobs SET ${assignments.join(', ')}, updated_at = SYSUTCDATETIME()
    WHERE id = :id AND recruiter_id = :recruiterId;
    SELECT @@ROWCOUNT AS affected`, {
    replacements: { ...values, id, recruiterId },
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.affected || 0);
}

async function closeJob(id, recruiterId) {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query(`
      UPDATE dbo.jobs SET status = N'closed', updated_at = SYSUTCDATETIME()
      WHERE id = :id AND recruiter_id = :recruiterId AND status <> N'closed';
      SELECT @@ROWCOUNT AS affected`, {
      replacements: { id, recruiterId },
      type: QueryTypes.SELECT,
      transaction,
    });
    const affected = Number(rows[0]?.affected || 0);
    if (!affected) return 0;

    await sequelize.query(`
      UPDATE dbo.applications
      SET status = N'withdrawn', updated_at = SYSUTCDATETIME()
      WHERE job_id = :id
        AND status IN (N'applied', N'reviewing', N'interview_invited', N'interviewed', N'offered', N'offer_accepted')`, {
      replacements: { id },
      transaction,
    });
    return affected;
  });
}

module.exports = {
  listByRecruiter,
  findByIdAndRecruiter,
  findCompanyForRecruiter,
  createJob,
  updateJob,
  closeJob,
};
