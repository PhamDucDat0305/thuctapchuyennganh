module.exports = (sequelize, DataTypes) => sequelize.define('AdminAuditLog', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  adminId: { type: DataTypes.BIGINT, allowNull: false, field: 'admin_id' },
  action: { type: DataTypes.STRING(80), allowNull: false, field: 'action' },
  targetType: { type: DataTypes.STRING(40), allowNull: false, field: 'target_type' },
  targetId: { type: DataTypes.BIGINT, allowNull: true, field: 'target_id' },
  reason: { type: DataTypes.STRING(500), allowNull: true, field: 'reason' },
  ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: 'ip_address' },
  metadataJson: { type: DataTypes.TEXT, allowNull: true, field: 'metadata_json' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { tableName: 'admin_audit_logs', timestamps: false });
