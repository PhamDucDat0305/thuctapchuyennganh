const repository = require('../repositories/messages.repository');
const MESSAGE_PAGE_SIZE = 50;
function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function validId(value) { return typeof value === 'string' && /^[1-9]\d*$/.test(value); }
async function conversations(user) { return repository.listConversations(user.id); }
async function conversation({ user, contactId, query }) {
  if (!validId(contactId)) fail('Mã người dùng không hợp lệ');
  const hasBeforeId = query.beforeId !== undefined; const hasBeforeTimestamp = query.beforeTimestamp !== undefined;
  if (hasBeforeId !== hasBeforeTimestamp || (hasBeforeId && !validId(String(query.beforeId)))) fail('Con trỏ phân trang không hợp lệ');
  let beforeTimestamp = null;
  if (hasBeforeTimestamp) { beforeTimestamp = new Date(String(query.beforeTimestamp)); if (Number.isNaN(beforeTimestamp.getTime())) fail('Thời gian phân trang không hợp lệ'); }
  const rows = await repository.listConversation({ userId: user.id, contactId,
    beforeId: hasBeforeId ? query.beforeId : null, beforeTimestamp, pageSize: MESSAGE_PAGE_SIZE + 1 });
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const messages = rows.slice(0, MESSAGE_PAGE_SIZE).reverse().map(repository.toMessage);
  const oldest = messages[0];
  return { messages, hasMore, nextCursor: hasMore && oldest
    ? { beforeId: oldest.id, beforeTimestamp: new Date(oldest.timestamp).toISOString() } : null };
}
async function send({ user, receiverId, content }) {
  const recipient = String(receiverId ?? ''); const text = typeof content === 'string' ? content.trim() : '';
  if (!validId(recipient)) fail('Người nhận không hợp lệ');
  if (Number(recipient) === user.id) fail('Không thể gửi tin nhắn cho chính mình');
  if (!text || text.length > 2000) fail('Tin nhắn phải có từ 1 đến 2.000 ký tự');
  const message = await repository.send({ senderId: user.id, receiverId: recipient, content: text });
  if (!message) { const error = new Error('Không tìm thấy người nhận đang hoạt động'); error.status = 404; throw error; }
  return message;
}
async function markRead(user, contactId) {
  if (!validId(contactId)) fail('Mã người dùng không hợp lệ');
  return { ok: true, affected: await repository.markRead(user.id, contactId) };
}
module.exports = { conversations, conversation, send, markRead };
