module.exports = (sequelize, DataTypes) => sequelize.define('Application', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  jobId: { type: DataTypes.BIGINT, allowNull: false, field: 'job_id' },
  candidateId: { type: DataTypes.BIGINT, allowNull: false, field: 'candidate_id' },
  cvText: { type: DataTypes.TEXT, allowNull: true, field: 'cv_text' },
  cvId: { type: DataTypes.BIGINT, allowNull: true, field: 'cv_id' },
  status: { type: DataTypes.STRING(30), allowNull: false, field: 'status' },
  appliedAt: { type: DataTypes.DATE, allowNull: false, field: 'applied_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'applications' });
