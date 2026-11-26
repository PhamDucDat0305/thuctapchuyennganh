const { QueryTypes } = require('sequelize');
const { sequelize, User, CandidateProfile } = require('../models');

async function findProfile(userId) {
  return User.findOne({
    attributes: ['id', 'email', 'fullName', 'role', 'phone', 'searchStatus'],
    where: { id: userId },
    include: [{
      model: CandidateProfile,
      as: 'candidateProfile',
      attributes: ['title', 'location', 'experience', 'skills'],
      required: false,
    }],
  });
}

async function updateProfile(userId, userValues, profileValues) {
  await sequelize.transaction(async (transaction) => {
    if (Object.keys(userValues).length) {
      await User.update(userValues, { where: { id: userId }, transaction });
    }

    const columns = { title: 'title', location: 'location', experience: 'experience', skills: 'skills' };
    const keys = Object.keys(profileValues).filter((key) => columns[key]);
    if (!keys.length) return;

    const assignments = keys.map((key) => `${columns[key]} = :${key}`);
    const insertColumns = keys.map((key) => columns[key]).join(', ');
    const insertValues = keys.map((key) => `:${key}`).join(', ');
    await sequelize.query(`
      IF EXISTS (SELECT 1 FROM dbo.candidate_profiles WHERE user_id = :userId)
        UPDATE dbo.candidate_profiles SET ${assignments.join(', ')} WHERE user_id = :userId;
      ELSE
        INSERT INTO dbo.candidate_profiles (user_id, ${insertColumns})
        VALUES (:userId, ${insertValues})`, {
      replacements: { userId, ...profileValues },
      type: QueryTypes.RAW,
      transaction,
    });
  });
  return findProfile(userId);
}

async function findPasswordHash(userId) {
  return User.findOne({ attributes: ['passwordHash'], where: { id: userId }, raw: true });
}

async function updatePasswordHash(userId, passwordHash) {
  return User.update({ passwordHash }, { where: { id: userId } });
}

module.exports = { findProfile, updateProfile, findPasswordHash, updatePasswordHash };
