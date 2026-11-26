module.exports = (sequelize, DataTypes) => sequelize.define('JobReport', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id' },
  jobId: { type: DataTypes.BIGINT, allowNull: false, field: 'job_id' },
  reporterId: { type: DataTypes.BIGINT, allowNull: false, field: 'reporter_id' },
  fullName: { type: DataTypes.STRING(150), allowNull: false, field: 'full_name' },
  phone: { type: DataTypes.STRING(30), allowNull: false, field: 'phone' },
  address: { type: DataTypes.STRING(300), allowNull: false, field: 'address' },
  email: { type: DataTypes.STRING(255), allowNull: false, field: 'email' },
  content: { type: DataTypes.STRING(4000), allowNull: false, field: 'content' },
  status: { type: DataTypes.STRING(20), allowNull: false, field: 'status' },
  adminNote: { type: DataTypes.STRING(1000), allowNull: true, field: 'admin_note' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { tableName: 'job_reports' });
