const repository = require('../repositories/applications.repository');

function makeError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function isUniqueViolation(error) {
  const number = error.number ?? error.original?.number ?? error.parent?.number;
  return number === 2627 || number === 2601 || error.name === 'SequelizeUniqueConstraintError';
}

async function list(user) {
  return repository.listForUser(user);
}

async function get(id, user) {
  const application = await repository.findById(id, user);
  if (!application) throw makeError('Không tìm thấy đơn ứng tuyển', 404);
  return application;
}

async function check(jobId, candidateId) {
  const result = await repository.checkForCandidate(jobId, candidateId);
  if (!result) throw makeError('Không tìm thấy công việc', 404);
  return result;
}

async function listForJob(jobId, user) {
  return repository.listForJob(jobId, user);
}

async function create(candidateId, body) {
  const jobId = String(body.jobId || '');
  const cv = typeof body.cv === 'string' ? body.cv.trim() : '';
  const cvId = body.cvId == null || body.cvId === '' ? null : String(body.cvId);
  if (!validId(jobId)) throw makeError('Mã công việc không hợp lệ', 400);
  if (cv.length > 10000 || (!cv && !cvId)) {
    throw makeError('Hãy chọn CV đã tải lên hoặc nhập nội dung giới thiệu (tối đa 10.000 ký tự)', 400);
  }
  if (cvId && !validId(cvId)) throw makeError('Mã CV không hợp lệ', 400);

  const job = await repository.findJobForApplication(jobId, candidateId);
  if (!job) throw makeError('Tin không còn nhận ứng tuyển', 404);
  if (Number(job.blockedByActiveEmployment) === 1) {
    throw makeError(`Bạn đang hợp tác với ${job.companyName}. Bạn có thể ứng tuyển lại tại công ty này sau khi kết thúc hợp tác.`, 409, 'ACTIVE_EMPLOYMENT_AT_COMPANY');
  }
  if (cvId && !await repository.candidateOwnsAvailableCv(cvId, candidateId)) {
    throw makeError('Không tìm thấy CV của bạn', 404);
  }

  const values = { jobId, candidateId, cv, cvId };
  try {
    const id = await repository.insertApplication(values);
    return { status: 201, application: await repository.findById(String(id), { id: candidateId, role: 'candidate' }) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const reopenedId = await repository.reopenApplication(values);
    if (reopenedId) {
      return { status: 201, application: await repository.findById(String(reopenedId), { id: candidateId, role: 'candidate' }) };
    }
    throw makeError('Bạn đã ứng tuyển tin này rồi', 409);
  }
}

async function updateStatus(id, user, status) {
  const allowedStatuses = ['reviewing', 'hired', 'employment_ended', 'rejected', 'withdrawn'];
  if (!allowedStatuses.includes(status)) throw makeError('Trạng thái đơn ứng tuyển không hợp lệ', 400);

  const employerTransitions = {
    reviewing: ['applied', 'reviewing'],
    hired: ['offer_accepted'],
    employment_ended: ['hired', 'accepted'],
    rejected: ['applied', 'reviewing', 'interview_invited', 'interviewed', 'offered'],
  };
  const candidateTransitions = {
    withdrawn: ['applied', 'reviewing', 'interview_invited', 'interviewed', 'offered', 'offer_accepted'],
  };
  const transitions = user.role === 'admin'
    ? [...Object.keys(employerTransitions), ...Object.keys(candidateTransitions)]
    : user.role === 'candidate' ? Object.keys(candidateTransitions) : Object.keys(employerTransitions);
  const previousStatuses = user.role === 'admin'
    ? [...(employerTransitions[status] || []), ...(candidateTransitions[status] || [])]
    : user.role === 'candidate' ? candidateTransitions[status] : employerTransitions[status];

  const result = await repository.transitionStatus(id, user, status, previousStatuses || []);
  if (!result.found) throw makeError('Không tìm thấy đơn ứng tuyển trong phạm vi của bạn', 404);
  if (!transitions.includes(status) || !result.changed) {
    throw makeError(`Không thể chuyển đơn từ trạng thái ${result.currentStatus} sang ${status}`, 409);
  }
  return repository.findById(id, user);
}

async function withdraw(id, candidateId) {
  if (!await repository.withdraw(id, candidateId)) throw makeError('Không tìm thấy đơn có thể hủy', 404);
  return { ok: true };
}

module.exports = { list, get, check, listForJob, create, updateStatus, withdraw };
