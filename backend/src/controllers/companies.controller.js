const service = require('../services/companies.service');

async function getById(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Mã công ty không hợp lệ' });
  }
  return res.json(await service.getPublicCompany(req.params.id));
}

module.exports = { getById };
