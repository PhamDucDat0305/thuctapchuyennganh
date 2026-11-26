module.exports = (sequelize, DataTypes) => sequelize.define('CandidateProfile', {
  userId: { type: DataTypes.BIGINT, primaryKey: true, field: 'user_id' },
  headline: { type: DataTypes.STRING(200), allowNull: true, field: 'headline' },
  summary: { type: DataTypes.TEXT, allowNull: true, field: 'summary' },
  location: { type: DataTypes.STRING(200), allowNull: true, field: 'location' },
  skills: { type: DataTypes.TEXT, allowNull: true, field: 'skills' },
  experienceYears: { type: DataTypes.TINYINT, allowNull: true, field: 'experience_years' },
  searchStatus: { type: DataTypes.STRING(30), allowNull: true, field: 'search_status' },
  title: { type: DataTypes.STRING(200), allowNull: true, field: 'title' },
  experience: { type: DataTypes.STRING(100), allowNull: true, field: 'experience' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'candidate_profiles' });
