const { Op, QueryTypes } = require('sequelize');
const { sequelize, User, Message } = require('../models');

function toMessage(row) {
  return { id: Number(row.id), senderId: Number(row.senderId), receiverId: Number(row.receiverId),
    content: row.content, timestamp: row.timestamp, read: Boolean(row.read) };
}

async function listConversations(userId) {
  const rows = await sequelize.query(`
    WITH conversation_messages AS (
      SELECT m.id,m.sender_id,m.receiver_id,m.content,m.sent_at,m.is_read,
        CASE WHEN m.sender_id=:userId THEN m.receiver_id ELSE m.sender_id END AS contact_id,
        ROW_NUMBER() OVER(PARTITION BY CASE WHEN m.sender_id=:userId THEN m.receiver_id ELSE m.sender_id END ORDER BY m.sent_at DESC,m.id DESC) AS row_num,
        SUM(CASE WHEN m.receiver_id=:userId AND m.is_read=0 THEN 1 ELSE 0 END) OVER(
          PARTITION BY CASE WHEN m.sender_id=:userId THEN m.receiver_id ELSE m.sender_id END) AS unread_count
      FROM dbo.messages m WHERE m.sender_id=:userId OR m.receiver_id=:userId)
    SELECT cm.contact_id AS contactId,u.full_name AS fullName,u.role,c.id AS companyId,c.name AS companyName,
      cm.id AS messageId,cm.sender_id AS senderId,cm.receiver_id AS receiverId,cm.content,cm.sent_at AS [timestamp],
      cm.is_read AS [read],cm.unread_count AS unreadCount FROM conversation_messages cm
    INNER JOIN dbo.users u ON u.id=cm.contact_id AND u.status=N'active'
    LEFT JOIN dbo.companies c ON c.employer_id=u.id WHERE cm.row_num=1 ORDER BY cm.sent_at DESC,cm.id DESC`, {
    replacements: { userId },
    type: QueryTypes.SELECT,
  });
  return rows.map((row) => ({
    contact: { id: Number(row.contactId), fullName: row.fullName, role: row.role,
      companyId: row.companyId == null ? null : Number(row.companyId), companyName: row.companyName || null },
    lastMessage: toMessage({ id: row.messageId, senderId: row.senderId, receiverId: row.receiverId,
      content: row.content, timestamp: row.timestamp, read: row.read }),
    unreadCount: Number(row.unreadCount || 0),
  }));
}

async function listConversation({ userId, contactId, beforeId, beforeTimestamp, pageSize }) {
  const where = {
    [Op.or]: [
      { senderId: userId, receiverId: contactId },
      { senderId: contactId, receiverId: userId },
    ],
  };

  // Omit cursor predicates on the first page. Avoid sending nullable date/ID
  // parameters, which caused SQL Server conversion errors with the old query.
  if (beforeId != null && beforeTimestamp != null) {
    where[Op.and] = [{
      [Op.or]: [
        { sentAt: { [Op.lt]: beforeTimestamp } },
        { [Op.and]: [{ sentAt: beforeTimestamp }, { id: { [Op.lt]: beforeId } }] },
      ],
    }];
  }

  const rows = await Message.findAll({
    where,
    attributes: ['id', 'senderId', 'receiverId', 'content', 'sentAt', 'isRead'],
    order: [['sentAt', 'DESC'], ['id', 'DESC']],
    limit: pageSize,
    raw: true,
  });
  return rows.map((row) => ({
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    content: row.content,
    timestamp: row.sentAt,
    read: row.isRead,
  }));
}

async function send({ senderId, receiverId, content }) {
  return sequelize.transaction(async (transaction) => {
    const receiver = await User.findOne({
      where: { id: receiverId, status: 'active', role: { [Op.in]: ['candidate', 'employer'] } },
      attributes: ['id'], transaction,
    });
    if (!receiver) return null;

    const message = await Message.create({
      senderId,
      receiverId,
      content,
      sentAt: sequelize.literal('SYSUTCDATETIME()'),
      isRead: false,
      readAt: null,
    }, { transaction, fields: ['senderId', 'receiverId', 'content', 'sentAt', 'isRead', 'readAt'] });
    return toMessage({ id: message.id, senderId: message.senderId, receiverId: message.receiverId,
      content: message.content, timestamp: message.sentAt, read: message.isRead });
  });
}

async function markRead(userId, contactId) {
  const [affected] = await Message.update({
    isRead: true,
    readAt: sequelize.literal('SYSUTCDATETIME()'),
  }, { where: { senderId: contactId, receiverId: userId, isRead: false }, silent: true });
  return Number(affected || 0);
}

module.exports = { listConversations, listConversation, send, markRead, toMessage };
