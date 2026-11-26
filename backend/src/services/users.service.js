const repository = require('../repositories/users.repository');

function parseSkills(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === 'string') : [];
  } catch (_) {
    return value.split(',').map((skill) => skill.trim()).filter(Boolean);
  }
}

function profileFields(profile) {
  return {
    title: profile?.title || '',
    location: profile?.location || '',
    experience: profile?.experience || '',
    skills: parseSkills(profile?.skills),
  };
}

function mapPublicCandidate(user) {
  const profile = user.candidateProfile;
  return {
    id: Number(user.id),
    fullName: user.fullName,
    role: user.role,
    phone: '',
    companyId: null,
    companyName: null,
    searchStatus: Boolean(user.searchStatus),
    ...profileFields(profile),
  };
}

async function getPublicCandidate(id) {
  const user = await repository.findPublicCandidateById(id);
  if (!user) {
    const error = new Error('Không tìm thấy hồ sơ công khai');
    error.status = 404;
    throw error;
  }
  return mapPublicCandidate(user);
}

async function listDiscoverableCandidates() {
  const users = await repository.listDiscoverableCandidates();
  return users.map(mapPublicCandidate);
}

async function getUser(id, requester) {
  const target = await repository.findActiveUserAccessData(id);
  if (!target) {
    const error = new Error('Không tìm thấy người dùng');
    error.status = 404;
    throw error;
  }

  const isSelf = String(target.id) === String(requester.id);
  const isAdmin = requester.role === 'admin';
  const relatedEmployer = target.role === 'candidate'
    && requester.role === 'employer'
    && await repository.employerHasRelationship(id, requester.id);
  const canViewProfile = isSelf || isAdmin || (target.role === 'candidate'
    && requester.role === 'employer'
    && (Boolean(target.searchStatus) || relatedEmployer));

  if (!canViewProfile) {
    const error = new Error('Không tìm thấy người dùng');
    error.status = 404;
    throw error;
  }

  const user = await repository.findUserDetails(id);
  const canViewContact = isSelf || isAdmin || relatedEmployer;
  const profile = user.candidateProfile;
  const company = user.company;
  return {
    id: Number(user.id),
    email: canViewContact ? user.email : null,
    fullName: user.fullName,
    role: user.role,
    phone: canViewContact ? (user.phone || '') : null,
    searchStatus: Boolean(user.searchStatus),
    companyId: company ? Number(company.id) : null,
    companyName: company?.name || null,
    ...profileFields(profile),
  };
}

module.exports = { getPublicCandidate, listDiscoverableCandidates, getUser };
