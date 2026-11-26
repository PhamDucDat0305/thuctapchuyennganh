module.exports = (sequelize, DataTypes) => sequelize.define('CoverLetter', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  candidateId: { type: DataTypes.BIGINT, allowNull: false, field: 'candidate_id' },
  title: { type: DataTypes.STRING(150), allowNull: false, field: 'title' },
  content: { type: DataTypes.TEXT, allowNull: false, field: 'content' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'cover_letters' });
