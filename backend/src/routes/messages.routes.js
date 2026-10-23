const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));
const MESSAGE_PAGE_SIZE = 50;

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function toMessage(row) {
  return {
    id: Number(row.id),
    senderId: Number(row.senderId),
    receiverId: Number(row.receiverId),
    content: row.content,
    timestamp: row.timestamp,
    read: Boolean(row.read),
  };
}

router.get('/conversations', asyncHandler(async (req, res) => {
  const result = await getPool().request()
    .input('userId', sql.BigInt, req.user.id)
    .query(`
      WITH conversation_messages AS (
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.is_read,
          CASE WHEN m.sender_id = @userId THEN m.receiver_id ELSE m.sender_id END AS contact_id,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN m.sender_id = @userId THEN m.receiver_id ELSE m.sender_id END
            ORDER BY m.sent_at DESC, m.id DESC
          ) AS row_num,
          SUM(CASE WHEN m.receiver_id = @userId AND m.is_read = 0 THEN 1 ELSE 0 END) OVER (
            PARTITION BY CASE WHEN m.sender_id = @userId THEN m.receiver_id ELSE m.sender_id END
          ) AS unread_count
        FROM dbo.messages AS m
        WHERE m.sender_id = @userId OR m.receiver_id = @userId
      )
      SELECT cm.contact_id AS contactId, u.full_name AS fullName, u.role,
        cm.id AS messageId, cm.sender_id AS senderId, cm.receiver_id AS receiverId,
        cm.content, cm.sent_at AS [timestamp], cm.is_read AS [read], cm.unread_count AS unreadCount
      FROM conversation_messages AS cm
      INNER JOIN dbo.users AS u ON u.id = cm.contact_id AND u.status = N'active'
      WHERE cm.row_num = 1
      ORDER BY cm.sent_at DESC, cm.id DESC`);

  const conversations = result.recordset.map((row) => ({
    contact: { id: Number(row.contactId), fullName: row.fullName, role: row.role },
    lastMessage: toMessage({
      id: row.messageId, senderId: row.senderId, receiverId: row.receiverId,
      content: row.content, timestamp: row.timestamp, read: row.read,
    }),
    unreadCount: Number(row.unreadCount || 0),
  }));
  return res.json(conversations);
}));

router.get('/conversation/:contactId', asyncHandler(async (req, res) => {
  if (!validId(req.params.contactId)) return res.status(400).json({ error: 'Mã người dùng không hợp lệ' });
  const hasBeforeId = req.query.beforeId !== undefined;
  const hasBeforeTimestamp = req.query.beforeTimestamp !== undefined;
  if (hasBeforeId !== hasBeforeTimestamp || (hasBeforeId && !validId(String(req.query.beforeId)))) {
    return res.status(400).json({ error: 'Con trỏ phân trang không hợp lệ' });
  }
  let beforeTimestamp = null;
  if (hasBeforeTimestamp) {
    const parsedTimestamp = new Date(String(req.query.beforeTimestamp));
    if (Number.isNaN(parsedTimestamp.getTime())) return res.status(400).json({ error: 'Thời gian phân trang không hợp lệ' });
    beforeTimestamp = parsedTimestamp;
  }

  const result = await getPool().request()
    .input('userId', sql.BigInt, req.user.id)
    .input('contactId', sql.BigInt, req.params.contactId)
    .input('beforeId', sql.BigInt, hasBeforeId ? req.query.beforeId : null)
    .input('beforeTimestamp', sql.DateTime2(0), beforeTimestamp)
    .input('pageSize', sql.Int, MESSAGE_PAGE_SIZE + 1)
    .query(`
      SELECT TOP (@pageSize) id, sender_id AS senderId, receiver_id AS receiverId, content,
        sent_at AS [timestamp], is_read AS [read]
      FROM dbo.messages
      WHERE ((sender_id = @userId AND receiver_id = @contactId)
         OR (sender_id = @contactId AND receiver_id = @userId))
        AND (@beforeId IS NULL OR sent_at < @beforeTimestamp
          OR (sent_at = @beforeTimestamp AND id < @beforeId))
      ORDER BY sent_at DESC, id DESC`);
  const hasMore = result.recordset.length > MESSAGE_PAGE_SIZE;
  const rows = result.recordset.slice(0, MESSAGE_PAGE_SIZE).reverse();
  const messages = rows.map(toMessage);
  const oldest = messages[0];
  return res.json({
    messages,
    hasMore,
    nextCursor: hasMore && oldest ? { beforeId: oldest.id, beforeTimestamp: new Date(oldest.timestamp).toISOString() } : null,
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const receiverId = String(req.body?.receiverId ?? '');
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!validId(receiverId)) return res.status(400).json({ error: 'Người nhận không hợp lệ' });
  if (Number(receiverId) === req.user.id) return res.status(400).json({ error: 'Không thể gửi tin nhắn cho chính mình' });
  if (!content || content.length > 2000) return res.status(400).json({ error: 'Tin nhắn phải có từ 1 đến 2.000 ký tự' });

  const inserted = await getPool().request()
    .input('senderId', sql.BigInt, req.user.id)
    .input('receiverId', sql.BigInt, receiverId)
    .input('content', sql.NVarChar(2000), content)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @receiverId AND status = N'active'
        AND role IN (N'candidate', N'employer'))
      BEGIN
        SELECT CAST(0 AS bit) AS receiverExists;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.messages (sender_id, receiver_id, content)
        OUTPUT inserted.id, inserted.sender_id AS senderId, inserted.receiver_id AS receiverId,
          inserted.content, inserted.sent_at AS [timestamp], inserted.is_read AS [read]
        VALUES (@senderId, @receiverId, @content);
      END`);
  const row = inserted.recordset[0];
  if (!row || row.receiverExists === false) return res.status(404).json({ error: 'Không tìm thấy người nhận đang hoạt động' });
  return res.status(201).json(toMessage(row));
}));

router.patch('/read/:contactId', asyncHandler(async (req, res) => {
  if (!validId(req.params.contactId)) return res.status(400).json({ error: 'Mã người dùng không hợp lệ' });
  const result = await getPool().request()
    .input('userId', sql.BigInt, req.user.id)
    .input('contactId', sql.BigInt, req.params.contactId)
    .query(`
      UPDATE dbo.messages
      SET is_read = 1, read_at = SYSUTCDATETIME()
      WHERE sender_id = @contactId AND receiver_id = @userId AND is_read = 0;
      SELECT @@ROWCOUNT AS affected;`);
  return res.json({ ok: true, affected: result.recordset[0].affected });
}));

module.exports = router;
