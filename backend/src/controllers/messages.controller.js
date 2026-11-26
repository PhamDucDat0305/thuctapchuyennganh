const service = require('../services/messages.service');
const { publishMessage } = require('../services/messages-events');
async function conversations(req, res) { return res.json(await service.conversations(req.user)); }
async function conversation(req, res) { return res.json(await service.conversation({ user: req.user, contactId: req.params.contactId, query: req.query })); }
async function send(req, res) {
  const message = await service.send({ user: req.user, receiverId: req.body?.receiverId, content: req.body?.content });
  publishMessage(message);
  return res.status(201).json(message);
}
async function markRead(req, res) { return res.json(await service.markRead(req.user, req.params.contactId)); }
module.exports = { conversations, conversation, send, markRead };
