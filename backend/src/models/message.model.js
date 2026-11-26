module.exports = (sequelize, DataTypes) => sequelize.define('Message', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  senderId: { type: DataTypes.BIGINT, allowNull: false, field: 'sender_id' },
  receiverId: { type: DataTypes.BIGINT, allowNull: false, field: 'receiver_id' },
  content: { type: DataTypes.STRING(2000), allowNull: false, field: 'content' },
  sentAt: { type: DataTypes.DATE, allowNull: false, field: 'sent_at' },
  readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_read' },
}, { tableName: 'messages', timestamps: false });
