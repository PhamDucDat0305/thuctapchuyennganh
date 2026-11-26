const { QueryTypes } = require('sequelize');
const { sequelize, EmployerSavedCandidate, User, CandidateProfile } = require('../models');

async function listByEmployer(employerId) {
  const records = await EmployerSavedCandidate.findAll({
    attributes: ['candidateId', 'savedAt'],
    where: { employerId },
    include: [{
      model: User,
      as: 'candidate',
      attributes: ['id', 'fullName'],
      required: true,
      where: { role: 'candidate', status: 'active', searchStatus: true },
      include: [{
        model: CandidateProfile,
        as: 'candidateProfile',
        attributes: ['title', 'location', 'experience', 'skills'],
        required: false,
      }],
    }],
    order: [['savedAt', 'DESC'], ['candidateId', 'DESC']],
  });

  return records.map((record) => {
    const candidate = record.candidate;
    const profile = candidate.candidateProfile;
    return {
      id: Number(candidate.id),
      fullName: candidate.fullName,
      title: profile?.title ?? null,
      location: profile?.location ?? null,
      experience: profile?.experience ?? null,
      skills: profile?.skills ?? null,
      savedAt: record.savedAt,
    };
  });
}

async function findAvailableCandidate(candidateId) {
  return User.findOne({
    attributes: ['id'],
    where: { id: candidateId, role: 'candidate', status: 'active', searchStatus: true },
    raw: true,
  });
}

async function lockExisting(employerId, candidateId, transaction) {
  const rows = await sequelize.query(`
    SELECT TOP (1) 1 AS found
    FROM dbo.employer_saved_candidates WITH (UPDLOCK, HOLDLOCK)
    WHERE employer_id = :employerId AND candidate_id = :candidateId`, {
    replacements: { employerId, candidateId },
    type: QueryTypes.SELECT,
    transaction,
  });
  return rows.length > 0;
}

async function create(employerId, candidateId, transaction) {
  // Let SQL Server populate saved_at from its DEFAULT constraint.
  return sequelize.query(`
    INSERT INTO dbo.employer_saved_candidates (employer_id, candidate_id)
    VALUES (:employerId, :candidateId)`, {
    replacements: { employerId, candidateId },
    transaction,
  });
}

async function remove(employerId, candidateId) {
  return sequelize.query(`
    DELETE FROM dbo.employer_saved_candidates
    WHERE employer_id = :employerId AND candidate_id = :candidateId`, {
    replacements: { employerId, candidateId },
  });
}

module.exports = { listByEmployer, findAvailableCandidate, lockExisting, create, remove, sequelize };
