const service = require('../services/test.service');

async function checkDatabase(req, res) {
  const result = await service.checkDatabase();
  return res.json(result);
}

module.exports = { checkDatabase };
