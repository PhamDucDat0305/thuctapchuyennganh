const { QueryTypes, Op, literal } = require('sequelize');
const { sequelize, SavedJob, Job, Company, User } = require('../models');

async function listByCandidate(candidateId) {
  const rows = await SavedJob.findAll({
    attributes: ['candidateId', 'jobId', 'savedAt'],
    where: { candidateId },
    order: [['savedAt', 'DESC'], ['jobId', 'DESC']],
    raw: true,
  });
  return rows.map((row) => ({
    userId: Number(row.candidateId),
    jobId: Number(row.jobId),
    savedAt: row.savedAt,
  }));
}

async function exists(candidateId, jobId) {
  return Boolean(await SavedJob.findOne({
    attributes: ['candidateId'],
    where: { candidateId, jobId },
    raw: true,
  }));
}

async function lockExisting(candidateId, jobId, transaction) {
  // Preserve SQL Server key/range lock semantics from the original implementation.
  const rows = await sequelize.query(`
    SELECT TOP (1) 1 AS found
    FROM dbo.saved_jobs WITH (UPDLOCK, HOLDLOCK)
    WHERE candidate_id = :candidateId AND job_id = :jobId`, {
    replacements: { candidateId, jobId },
    type: QueryTypes.SELECT,
    transaction,
  });
  return rows.length > 0;
}

async function isJobAvailable(jobId, transaction) {
  const job = await Job.findOne({
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
    transaction,
  });
  return Boolean(job);
}

async function remove(candidateId, jobId, transaction) {
  return sequelize.query(`
    DELETE FROM dbo.saved_jobs
    WHERE candidate_id = :candidateId AND job_id = :jobId`, {
    replacements: { candidateId, jobId },
    transaction,
  });
}

async function create(candidateId, jobId, transaction) {
  // Let SQL Server populate saved_at from its DEFAULT constraint.
  return sequelize.query(`
    INSERT INTO dbo.saved_jobs (candidate_id, job_id)
    VALUES (:candidateId, :jobId)`, {
    replacements: { candidateId, jobId },
    transaction,
  });
}

module.exports = { listByCandidate, exists, lockExisting, isJobAvailable, remove, create };
