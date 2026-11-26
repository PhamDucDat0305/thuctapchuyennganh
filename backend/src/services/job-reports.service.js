const repository = require('../repositories/job-reports.repository');

async function createReport(values) {
  if (!await repository.findReportableJob(values.jobId)) {
    const error = new Error('Không tìm thấy tin tuyển dụng để phản ánh');
    error.status = 404;
    throw error;
  }
  return repository.create(values);
}

module.exports = { createReport };
