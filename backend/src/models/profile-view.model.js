module.exports = (sequelize, DataTypes) => sequelize.define('ProfileView', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  employerId: { type: DataTypes.BIGINT, allowNull: false, field: 'employer_id' },
  candidateId: { type: DataTypes.BIGINT, allowNull: false, field: 'candidate_id' },
  viewedAt: { type: DataTypes.DATE, allowNull: false, field: 'viewed_at' },
}, { tableName: 'profile_views' });
