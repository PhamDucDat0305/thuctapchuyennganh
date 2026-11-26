const { Transaction } = require('sequelize');
const repository = require('../repositories/employer-saved-candidates.repository');

async function list(employerId) {
  return repository.listByEmployer(employerId);
}

async function save(employerId, candidateId) {
  if (!await repository.findAvailableCandidate(candidateId)) {
    const error = new Error('Không tìm thấy ứng viên đang hoạt động');
    error.status = 404;
    throw error;
  }

  return repository.sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  }, async (transaction) => {
    if (await repository.lockExisting(employerId, candidateId, transaction)) {
      return { saved: true, created: false };
    }
    await repository.create(employerId, candidateId, transaction);
    return { saved: true, created: true };
  });
}

async function remove(employerId, candidateId) {
  await repository.remove(employerId, candidateId);
  return { saved: false };
}

module.exports = { list, save, remove };
