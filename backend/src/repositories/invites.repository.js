const { QueryTypes } = require('sequelize');
const { sequelize, Invite, User, Company, Job, CandidateProfile } = require('../models');

const inviteIncludes = [
  {
    model: User,
    as: 'employer',
    attributes: [],
    required: false,
    include: [{
      model: Company,
      as: 'company',
      attributes: ['id', 'name'],
      required: false,
    }],
  },
  { model: Job, as: 'job', attributes: ['title'], required: false },
];

const candidateInviteInclude = [
  {
    model: User,
    as: 'candidate',
    attributes: ['id', 'fullName', 'email'],
    required: true,
    include: [{
      model: CandidateProfile,
      as: 'candidateProfile',
      attributes: ['title', 'location', 'experience', 'skills'],
      required: false,
    }],
  },
  { model: Job, as: 'job', attributes: ['title'], required: false },
];

function toInviteResponse(row) {
  const company = row.employer?.company;
  const job = row.job;
  return {
    id: Number(row.id),
    employerId: Number(row.employerId),
    candidateId: Number(row.candidateId),
    jobId: row.jobId == null ? null : Number(row.jobId),
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    companyId: company ? Number(company.id) : null,
    companyName: company?.name ?? null,
    jobTitle: job?.title ?? null,
  };
}

async function listForCandidate(candidateId) {
  const rows = await Invite.findAll({
    where: { candidateId },
    include: inviteIncludes,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return rows.map(toInviteResponse);
}

function toEmployerInviteResponse(row) {
  const candidate = row.candidate;
  const profile = candidate?.candidateProfile;
  return {
    id: Number(row.id),
    employerId: Number(row.employerId),
    candidateId: Number(row.candidateId),
    jobId: row.jobId == null ? null : Number(row.jobId),
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fullName: candidate?.fullName ?? null,
    email: row.status === 'accepted' ? (candidate?.email ?? null) : null,
    title: profile?.title ?? null,
    location: profile?.location ?? null,
    experience: profile?.experience ?? null,
    skills: profile?.skills ?? null,
    jobTitle: row.job?.title ?? null,
  };
}

async function listForEmployer(employerId) {
  const rows = await Invite.findAll({
    where: { employerId },
    include: candidateInviteInclude,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return rows.map(toEmployerInviteResponse);
}

async function listConnectionsForEmployer(employerId) {
  const rows = await Invite.findAll({
    where: { employerId, status: 'accepted' },
    include: candidateInviteInclude,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  const uniqueCandidates = new Map();
  for (const row of rows) {
    const mapped = toEmployerInviteResponse(row);
    if (!uniqueCandidates.has(String(mapped.candidateId))) uniqueCandidates.set(String(mapped.candidateId), mapped);
  }
  return [...uniqueCandidates.values()];
}

async function findActiveCandidate(candidateId) {
  return User.findOne({
    attributes: ['id'],
    where: { id: candidateId, role: 'candidate', status: 'active' },
    raw: true,
  });
}

async function employerOwnsJob(jobId, employerId) {
  return Job.findOne({ attributes: ['id'], where: { id: jobId, recruiterId: employerId }, raw: true });
}

async function hasPendingDuplicate(employerId, candidateId, jobId) {
  return Boolean(await Invite.findOne({
    attributes: ['id'],
    where: { employerId, candidateId, jobId, status: 'pending' },
    raw: true,
  }));
}

async function insert(values) {
  const rows = await sequelize.query(`
    INSERT INTO dbo.invites (employer_id, candidate_id, job_id, message)
    VALUES (:employerId, :candidateId, :jobId, :message);
    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS id`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

async function findById(id) {
  const row = await Invite.findOne({ where: { id }, include: inviteIncludes });
  return row ? toInviteResponse(row) : null;
}

async function updatePendingStatus(id, candidateId, status) {
  const rows = await sequelize.query(`
    UPDATE dbo.invites
    SET status = :status, updated_at = SYSUTCDATETIME()
    WHERE id = :id AND candidate_id = :candidateId AND status = N'pending';
    SELECT @@ROWCOUNT AS affected`, {
    replacements: { id, candidateId, status },
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.affected || 0);
}

async function findStatusForCandidate(id, candidateId) {
  return Invite.findOne({ attributes: ['status'], where: { id, candidateId }, raw: true });
}

async function deleteAcceptedConnection(employerId, candidateId) {
  return Invite.destroy({ where: { employerId, candidateId, status: 'accepted' } });
}

module.exports = {
  listForCandidate,
  listForEmployer,
  listConnectionsForEmployer,
  findActiveCandidate,
  employerOwnsJob,
  hasPendingDuplicate,
  insert,
  findById,
  updatePendingStatus,
  findStatusForCandidate,
  deleteAcceptedConnection,
};
