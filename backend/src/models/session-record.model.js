module.exports = (sequelize, DataTypes) => sequelize.define('SessionRecord', {
  sid: { type: DataTypes.STRING(255), primaryKey: true, field: 'sid' },
  session: { type: DataTypes.TEXT, allowNull: false, field: 'session' },
  expires: { type: DataTypes.DATE, allowNull: false, field: 'expires' },
}, { tableName: 'sessions', timestamps: false });
