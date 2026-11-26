module.exports = (sequelize, DataTypes) => sequelize.define('EmployerSavedCandidate', {
  employerId: { type: DataTypes.BIGINT, primaryKey: true, field: 'employer_id' },
  candidateId: { type: DataTypes.BIGINT, primaryKey: true, field: 'candidate_id' },
  savedAt: { type: DataTypes.DATE, allowNull: false, field: 'saved_at' },
}, { tableName: 'employer_saved_candidates' });
