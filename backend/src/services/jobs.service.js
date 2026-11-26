const repository = require('../repositories/jobs.repository');

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function listPublicJobs() {
  return repository.listPublicJobs();
}

async function getPublicJob(id) {
  const job = await repository.findPublicJobById(id);
  if (!job) throw makeError('Không tìm thấy việc làm', 404);
  return job;
}

async function countPublicView(id, viewerId) {
  const row = await repository.countPublicView(id, viewerId);
  return row && Number(row.counted) === 1
    ? { counted: true, views: Number(row.views) }
    : { counted: false };
}

module.exports = { listPublicJobs, getPublicJob, countPublicView };
