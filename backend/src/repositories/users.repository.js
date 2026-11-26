const { User, CandidateProfile, Company, Application, Job, Invite } = require('../models');

const profileAttributes = ['title', 'location', 'experience', 'skills'];

async function findPublicCandidateById(id) {
  return User.findOne({
    attributes: ['id', 'fullName', 'role', 'searchStatus'],
    where: { id, role: 'candidate', status: 'active', searchStatus: true },
    include: [{
      model: CandidateProfile,
      as: 'candidateProfile',
      attributes: profileAttributes,
      required: false,
    }],
  });
}

async function listDiscoverableCandidates() {
  return User.findAll({
    attributes: ['id', 'fullName', 'role', 'searchStatus'],
    where: { role: 'candidate', status: 'active', searchStatus: true },
    include: [{
      model: CandidateProfile,
      as: 'candidateProfile',
      attributes: profileAttributes,
      required: false,
    }],
    order: [['fullName', 'ASC'], ['id', 'ASC']],
  });
}

async function findActiveUserAccessData(id) {
  return User.findOne({
    attributes: ['id', 'role', 'searchStatus'],
    where: { id, status: 'active' },
    raw: true,
  });
}

async function employerHasRelationship(candidateId, employerId) {
  const hasApplication = await Application.findOne({
    attributes: ['id'],
    where: { candidateId },
    include: [{
      model: Job,
      as: 'job',
      attributes: [],
      required: true,
      where: { recruiterId: employerId },
    }],
    raw: true,
  });
  if (hasApplication) return true;
  return Boolean(await Invite.findOne({
    attributes: ['id'],
    where: { candidateId, employerId, status: 'accepted' },
    raw: true,
  }));
}

async function findUserDetails(id) {
  return User.findOne({
    attributes: ['id', 'email', 'fullName', 'role', 'phone', 'searchStatus'],
    where: { id, status: 'active' },
    include: [
      {
        model: CandidateProfile,
        as: 'candidateProfile',
        attributes: profileAttributes,
        required: false,
      },
      {
        model: Company,
        as: 'company',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
  });
}

module.exports = {
  findPublicCandidateById,
  listDiscoverableCandidates,
  findActiveUserAccessData,
  employerHasRelationship,
  findUserDetails,
};
