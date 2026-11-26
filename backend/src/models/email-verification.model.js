module.exports = (sequelize, DataTypes) => sequelize.define('EmailVerification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
  email: { type: DataTypes.STRING(255), allowNull: false, field: 'email' },
  otpHash: { type: DataTypes.STRING(64), allowNull: false, field: 'otp_hash' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  attemptCount: { type: DataTypes.INTEGER, allowNull: false, field: 'attempt_count' },
  lastSentAt: { type: DataTypes.DATE, allowNull: false, field: 'last_sent_at' },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  verificationTokenHash: { type: DataTypes.STRING(64), allowNull: true, field: 'verification_token_hash' },
  verificationExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'verification_expires_at' },
  consumedAt: { type: DataTypes.DATE, allowNull: true, field: 'consumed_at' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { tableName: 'email_verifications', timestamps: false });
