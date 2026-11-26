const { QueryTypes } = require('sequelize');
const { sequelize, ProfileView, User, Company } = require('../models');

async function listByCandidate(candidateId) {
  const rows = await ProfileView.findAll({
    attributes: ['id', 'employerId', 'candidateId', 'viewedAt'],
    where: { candidateId },
    include: [{
      model: User,
      as: 'employer',
      attributes: [],
      required: true,
      include: [{
        model: Company,
        as: 'company',
        attributes: ['id', 'name', 'industry'],
        required: false,
      }],
    }],
    order: [['viewedAt', 'DESC'], ['id', 'DESC']],
  });

  return rows.map((row) => {
    const company = row.employer?.company;
    return {
      id: Number(row.id),
      employerId: Number(row.employerId),
      candidateId: Number(row.candidateId),
      viewedAt: row.viewedAt,
      companyId: company ? Number(company.id) : null,
      companyName: company?.name ?? null,
      industry: company?.industry ?? null,
    };
  });
}

async function findActiveCandidate(candidateId) {
  return User.findOne({
    attributes: ['id'],
    where: { id: candidateId, role: 'candidate', status: 'active' },
    raw: true,
  });
}

async function lockExisting(employerId, candidateId, transaction) {
  const rows = await sequelize.query(`
    SELECT TOP (1) 1 AS found
    FROM dbo.profile_views WITH (UPDLOCK, HOLDLOCK)
    WHERE employer_id = :employerId AND candidate_id = :candidateId`, {
    replacements: { employerId, candidateId },
    type: QueryTypes.SELECT,
    transaction,
  });
  return rows.length > 0;
}

async function create(employerId, candidateId, transaction) {
  // SQL Server defaults populate viewed_at; do not use OUTPUT against this table.
  await sequelize.query(`
    INSERT INTO dbo.profile_views (employer_id, candidate_id)
    VALUES (:employerId, :candidateId)`, {
    replacements: { employerId, candidateId },
    transaction,
  });
}

module.exports = { listByCandidate, findActiveCandidate, lockExisting, create, sequelize };
