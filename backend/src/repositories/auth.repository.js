const crypto = require("node:crypto");
const { QueryTypes, Transaction } = require("sequelize");
const { sequelize, User, Company, CandidateProfile } = require("../models");

async function emailExists(email) {
  return (await User.count({ where: { email } })) > 0;
}
async function register({
  email,
  passwordHash,
  fullName,
  phone,
  role,
  companyName,
  verificationToken,
}) {
  const tx = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  });
  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const verification = await sequelize.query(
      `SELECT TOP (1) id FROM dbo.email_verifications WITH (UPDLOCK,HOLDLOCK)
        WHERE email=:email AND verification_token_hash=:tokenHash AND verified_at IS NOT NULL
          AND verification_expires_at>SYSUTCDATETIME() AND consumed_at IS NULL ORDER BY id DESC`,
      {
        replacements: { email, tokenHash },
        transaction: tx,
        type: QueryTypes.SELECT,
      },
    );
    if (!verification.length) {
      const error = new Error(
        "Xác minh email đã hết hạn hoặc đã được sử dụng. Hãy xác minh lại.",
      );
      error.status = 400;
      throw error;
    }

    const now = sequelize.literal("SYSUTCDATETIME()");
    const user = await User.create(
      {
        email,
        passwordHash,
        fullName,
        phone: phone || null,
        role,
        status: "active",
        searchStatus: true,
        adminLocked: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        transaction: tx,
        fields: [
          "email",
          "passwordHash",
          "fullName",
          "phone",
          "role",
          "status",
          "searchStatus",
          "adminLocked",
          "createdAt",
          "updatedAt",
        ],
      },
    );
    const userId = user.id;
    if (role === "candidate") {
      await CandidateProfile.create(
        { userId, createdAt: now, updatedAt: now },
        {
          transaction: tx,
          fields: ["userId", "createdAt", "updatedAt"],
        },
      );
    } else {
      await Company.create(
        {
          employerId: userId,
          name: companyName,
          adminStatus: "active",
          createdAt: now,
          updatedAt: now,
        },
        {
          transaction: tx,
          fields: [
            "employerId",
            "name",
            "adminStatus",
            "createdAt",
            "updatedAt",
          ],
        },
      );
    }
    const consumed = await sequelize.query(
      `UPDATE dbo.email_verifications SET consumed_at=SYSUTCDATETIME()
      WHERE id=:id AND consumed_at IS NULL; SELECT @@ROWCOUNT AS affected;`,
      {
        replacements: { id: verification[0].id },
        transaction: tx,
        type: QueryTypes.SELECT,
      },
    );
    if (Number(consumed[0]?.affected) !== 1)
      throw new Error("Không thể sử dụng token xác minh email");
    await tx.commit();
    return Number(userId);
  } catch (error) {
    await tx.rollback().catch(() => {});
    const number =
      error.number || error.original?.number || error.parent?.number;
    if (number === 2627 || number === 2601) {
      const conflict = new Error("Email đã được đăng ký");
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
}
async function findLoginUser(email) {
  const user = await User.findOne({
    where: { email },
    attributes: [
      "id",
      "email",
      "passwordHash",
      "fullName",
      "role",
      "status",
      "adminLocked",
    ],
  });
  if (!user) return null;
  // Preserve the repository contract consumed by auth.service.js.
  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    full_name: user.fullName,
    role: user.role,
    status: user.status,
    admin_locked: user.adminLocked,
  };
}
module.exports = { emailExists, register, findLoginUser };
