module.exports = (sequelize, DataTypes) => sequelize.define('SavedJob', {
  candidateId: { type: DataTypes.BIGINT, primaryKey: true, field: 'candidate_id' },
  jobId: { type: DataTypes.BIGINT, primaryKey: true, field: 'job_id' },
  savedAt: { type: DataTypes.DATE, allowNull: false, field: 'saved_at' },
}, { tableName: 'saved_jobs' });
