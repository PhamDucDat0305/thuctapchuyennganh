const { QueryTypes, Op } = require('sequelize');
const {
  sequelize,
  CandidateCv,
  CoverLetter,
  Application,
  Job,
} = require('../models');

async function listCvs(candidateId) {
  return CandidateCv.findAll({
    attributes: ['id', 'candidateId', 'title', 'originalName', 'storedName', 'mimeType', 'sizeBytes', 'isDefault', 'createdAt', 'updatedAt'],
    where: { candidateId },
    order: [['isDefault', 'DESC'], ['updatedAt', 'DESC'], ['id', 'DESC']],
    raw: true,
  });
}

async function insertCv(values) {
  const rows = await sequelize.query(`
    INSERT INTO dbo.candidate_cvs
      (candidate_id, title, original_name, stored_name, file_url, mime_type, size_bytes)
    VALUES
      (:candidateId, :title, :originalName, :storedName, :fileUrl, :mimeType, :sizeBytes);
    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS id`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

async function findCv(id) {
  return CandidateCv.findOne({
    attributes: ['id', 'candidateId', 'originalName', 'storedName', 'mimeType', 'sizeBytes'],
    where: { id },
    raw: true,
  });
}

async function findOwnedCv(id, candidateId) {
  return CandidateCv.findOne({
    attributes: ['id', 'storedName'],
    where: { id, candidateId },
    raw: true,
  });
}

async function isCvInUse(cvId) {
  return Boolean(await Application.findOne({ attributes: ['id'], where: { cvId }, raw: true }));
}

async function setDefaultCv(id, candidateId) {
  return sequelize.transaction(async (transaction) => {
    const existing = await sequelize.query(`
      SELECT TOP (1) id FROM dbo.candidate_cvs WITH (UPDLOCK, ROWLOCK)
      WHERE id = :id AND candidate_id = :candidateId`, {
      replacements: { id, candidateId },
      type: QueryTypes.SELECT,
      transaction,
    });
    if (!existing.length) return false;

    await sequelize.query(`
      UPDATE dbo.candidate_cvs
      SET is_default = 0, updated_at = SYSUTCDATETIME()
      WHERE candidate_id = :candidateId AND is_default = 1`, {
      replacements: { candidateId },
      transaction,
    });
    await sequelize.query(`
      UPDATE dbo.candidate_cvs
      SET is_default = 1, updated_at = SYSUTCDATETIME()
      WHERE id = :id`, {
      replacements: { id },
      transaction,
    });
    return true;
  });
}

async function deleteCv(id, candidateId) {
  return CandidateCv.destroy({ where: { id, candidateId } });
}

async function employerCanDownloadCv(cvId, candidateId, recruiterId) {
  return Boolean(await Application.findOne({
    attributes: ['id'],
    where: { cvId, candidateId, status: { [Op.ne]: 'withdrawn' } },
    include: [{
      model: Job,
      as: 'job',
      attributes: [],
      required: true,
      where: { recruiterId },
    }],
    raw: true,
  }));
}

async function listCoverLetters(candidateId) {
  const rows = await CoverLetter.findAll({
    attributes: ['id', 'title', 'content', 'createdAt', 'updatedAt'],
    where: { candidateId },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    raw: true,
  });
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function insertCoverLetter(candidateId, title, content) {
  const rows = await sequelize.query(`
    INSERT INTO dbo.cover_letters (candidate_id, title, content)
    VALUES (:candidateId, :title, :content);
    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS id`, {
    replacements: { candidateId, title, content },
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

async function updateCoverLetter(id, candidateId, title, content) {
  const rows = await sequelize.query(`
    UPDATE dbo.cover_letters
    SET title = :title, content = :content, updated_at = SYSUTCDATETIME()
    WHERE id = :id AND candidate_id = :candidateId;
    SELECT @@ROWCOUNT AS affected`, {
    replacements: { id, candidateId, title, content },
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.affected || 0);
}

async function deleteCoverLetter(id, candidateId) {
  const rows = await sequelize.query(`
    DELETE FROM dbo.cover_letters WHERE id = :id AND candidate_id = :candidateId;
    SELECT @@ROWCOUNT AS affected`, {
    replacements: { id, candidateId },
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.affected || 0);
}

module.exports = {
  listCvs,
  insertCv,
  findCv,
  findOwnedCv,
  isCvInUse,
  setDefaultCv,
  deleteCv,
  employerCanDownloadCv,
  listCoverLetters,
  insertCoverLetter,
  updateCoverLetter,
  deleteCoverLetter,
};
