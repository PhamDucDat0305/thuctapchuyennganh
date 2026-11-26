const { Transaction } = require('sequelize');
const repository = require('../repositories/profile-views.repository');

async function list(candidateId) {
  return repository.listByCandidate(candidateId);
}

async function record(employerId, candidateId) {
  if (!await repository.findActiveCandidate(candidateId)) {
    const error = new Error('Không tìm thấy ứng viên đang hoạt động');
    error.status = 404;
    throw error;
  }

  const recorded = await repository.sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  }, async (transaction) => {
    if (await repository.lockExisting(employerId, candidateId, transaction)) return false;
    await repository.create(employerId, candidateId, transaction);
    return true;
  });

  return { recorded, countedOnce: true };
}

module.exports = { list, record };
