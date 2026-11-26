const service = require('../services/admin.service');
const wrap = (method) => async (req, res) => res.json(await service[method](req));
module.exports = {
  overview: wrap('overview'), users: wrap('users'), jobs: wrap('jobs'), companies: wrap('companies'),
  auditLogs: wrap('auditLogs'), reports: wrap('reports'), lockUser: wrap('lockUser'),
  visibility: wrap('visibility'), companyStatus: wrap('companyStatus'), updateReport: wrap('updateReport'),
};
