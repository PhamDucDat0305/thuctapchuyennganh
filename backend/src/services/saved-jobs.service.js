const { Transaction } = require('sequelize');
const { sequelize } = require('../models');
const repository = require('../repositories/saved-jobs.repository');

async function list(candidateId) {
  return repository.listByCandidate(candidateId);
}

async function check(candidateId, jobId) {
  return repository.exists(candidateId, jobId);
}

async function toggle(candidateId, jobId) {
  return sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  }, async (transaction) => {
    if (await repository.lockExisting(candidateId, jobId, transaction)) {
      await repository.remove(candidateId, jobId, transaction);
      return false;
    }

    if (!await repository.isJobAvailable(jobId, transaction)) {
      const error = new Error('Tin không còn khả dụng để lưu');
      error.status = 404;
      throw error;
    }

    await repository.create(candidateId, jobId, transaction);
    return true;
  });
}

async function remove(candidateId, jobId) {
  await repository.remove(candidateId, jobId);
  return false;
}

module.exports = { list, check, toggle, remove };
