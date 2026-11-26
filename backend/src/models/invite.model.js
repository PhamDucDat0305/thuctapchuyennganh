module.exports = (sequelize, DataTypes) => sequelize.define('Invite', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  employerId: { type: DataTypes.BIGINT, allowNull: false, field: 'employer_id' },
  candidateId: { type: DataTypes.BIGINT, allowNull: false, field: 'candidate_id' },
  jobId: { type: DataTypes.BIGINT, allowNull: true, field: 'job_id' },
  // job_key is a SQL Server computed column; omit it so create/update can never write it.
  message: { type: DataTypes.TEXT, allowNull: true, field: 'message' },
  status: { type: DataTypes.STRING(20), allowNull: false, field: 'status' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'invites' });
