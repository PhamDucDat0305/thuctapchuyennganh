const repository = require('../repositories/companies.repository');

async function getPublicCompany(id) {
  const company = await repository.findPublicById(id);
  if (!company) {
    const error = new Error('Không tìm thấy công ty');
    error.status = 404;
    throw error;
  }
  return {
    ...company,
    id: Number(company.id),
    employerId: Number(company.employerId),
  };
}

module.exports = { getPublicCompany };
