const service = require('../services/me.service');

function getCurrent(req, res) {
  return res.json({ user: req.user });
}

async function updateProfile(req, res) {
  return res.json(await service.updateProfile(req.user, req.body || {}));
}

async function changePassword(req, res) {
  return res.json(await service.changePassword(req.user.id, req.body));
}

module.exports = { getCurrent, updateProfile, changePassword };
