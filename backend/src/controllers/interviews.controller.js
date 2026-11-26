const service = require('../services/interviews.service');
async function list(req, res) { return res.json(await service.list(req.user)); }
async function findForApplication(req, res) { return res.json(await service.findForApplication(req.params.applicationId, req.user)); }
async function schedule(req, res) { return res.status(201).json(await service.schedule({ ...req.body, recruiterId: req.user.id })); }
async function decide(req, res) { return res.json(await service.decide({ id: req.params.id, recruiterId: req.user.id, decision: req.body?.decision })); }
async function updateStatus(req, res) { return res.json(await service.updateStatus({ id: req.params.id, user: req.user, status: req.body?.status })); }
module.exports = { list, findForApplication, schedule, decide, updateStatus };
