const repository = require('../repositories/invites.repository');

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isUniqueViolation(error) {
  const number = error.number ?? error.original?.number ?? error.parent?.number;
  return number === 2601 || number === 2627 || error.name === 'SequelizeUniqueConstraintError';
}

async function list(candidateId) {
  return repository.listForCandidate(candidateId);
}

async function listSent(employerId) {
  return repository.listForEmployer(employerId);
}

async function listConnections(employerId) {
  return repository.listConnectionsForEmployer(employerId);
}

async function removeConnection(employerId, candidateId) {
  const deleted = await repository.deleteAcceptedConnection(employerId, candidateId);
  if (!deleted) throw makeError('Không tìm thấy kết nối đang hoạt động', 404);
  return { ok: true };
}

async function create({ employerId, candidateId, jobId, message }) {
  if (!await repository.findActiveCandidate(candidateId)) {
    throw makeError('Không tìm thấy ứng viên đang hoạt động', 404);
  }
  if (jobId !== null && !await repository.employerOwnsJob(jobId, employerId)) {
    throw makeError('Không tìm thấy tin tuyển dụng của bạn', 404);
  }
  if (await repository.hasPendingDuplicate(employerId, candidateId, jobId)) {
    throw makeError('Bạn đã gửi lời mời đang chờ phản hồi cho ứng viên này', 409);
  }

  try {
    const id = await repository.insert({ employerId, candidateId, jobId, message: message || null });
    return repository.findById(id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw makeError('Bạn đã gửi lời mời đang chờ phản hồi cho ứng viên này', 409);
    }
    throw error;
  }
}

async function respond(id, candidateId, status) {
  const affected = await repository.updatePendingStatus(id, candidateId, status);
  if (affected) return { id: Number(id), status };

  const existing = await repository.findStatusForCandidate(id, candidateId);
  if (!existing) throw makeError('Không tìm thấy lời mời', 404);
  throw makeError('Lời mời này đã được xử lý', 409);
}

module.exports = { list, listSent, listConnections, removeConnection, create, respond };
