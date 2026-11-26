module.exports = (sequelize, DataTypes) => sequelize.define('User', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  email: { type: DataTypes.STRING(255), allowNull: false, field: 'email' },
  passwordHash: { type: DataTypes.STRING(255), allowNull: true, field: 'password_hash' },
  fullName: { type: DataTypes.STRING(150), allowNull: false, field: 'full_name' },
  username: { type: DataTypes.STRING(80), allowNull: true, field: 'username' },
  phone: { type: DataTypes.STRING(20), allowNull: true, field: 'phone' },
  role: { type: DataTypes.STRING(20), allowNull: false, field: 'role' },
  status: { type: DataTypes.STRING(20), allowNull: false, field: 'status' },
  searchStatus: { type: DataTypes.BOOLEAN, allowNull: false, field: 'search_status' },
  adminLocked: { type: DataTypes.BOOLEAN, allowNull: false, field: 'admin_locked' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { tableName: 'users' });
