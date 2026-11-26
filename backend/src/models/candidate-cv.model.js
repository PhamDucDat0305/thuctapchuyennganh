module.exports = (sequelize, DataTypes) => sequelize.define('CandidateCv', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  candidateId: { type: DataTypes.BIGINT, allowNull: false, field: 'candidate_id' },
  title: { type: DataTypes.STRING(300), allowNull: false, field: 'title' },
  fileUrl: { type: DataTypes.STRING(500), allowNull: false, field: 'file_url' },
  originalName: { type: DataTypes.STRING(255), allowNull: false, field: 'original_name' },
  storedName: { type: DataTypes.STRING(100), allowNull: false, field: 'stored_name' },
  mimeType: { type: DataTypes.STRING(100), allowNull: false, field: 'mime_type' },
  sizeBytes: { type: DataTypes.INTEGER, allowNull: false, field: 'size_bytes' },
  isDefault: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_default' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'candidate_cvs' });
