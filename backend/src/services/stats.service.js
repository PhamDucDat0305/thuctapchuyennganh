const repository = require('../repositories/stats.repository');

async function getOverview() {
  const row = await repository.getOverviewCounts();
  return {
    jobs: Number(row.jobs),
    companies: Number(row.companies),
    candidates: Number(row.candidates),
    applications: Number(row.applications),
  };
}

module.exports = { getOverview };
