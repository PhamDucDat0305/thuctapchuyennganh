const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const applicationSelect = `
  SELECT a.id, a.job_id AS jobId,
    a.candidate_id AS applicantId, a.candidate_id AS candidateId,
    j.recruiter_id AS recruiterId, u.full_name AS fullName, u.email,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE a.cv_text END AS cv,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE a.cv_id END AS cvId,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE cv.title END AS cvTitle,
    CASE WHEN a.status = N'withdrawn' THEN NULL ELSE cv.original_name END AS cvFileName,
    CASE WHEN cv.id IS NULL OR a.status = N'withdrawn' OR cv.size_bytes = 0 OR cv.stored_name LIKE N'legacy-missing-%' THEN NULL ELSE CONCAT(N'/api/candidate-content/cvs/', cv.id, N'/file') END AS cvDownloadUrl,
    a.status, a.applied_at AS appliedAt,
    a.updated_at AS updatedAt, i.status AS interviewStatus, j.title AS jobTitle,
    j.status AS jobStatus,
    c.id AS companyId, c.name AS companyName, j.location
  FROM dbo.applications AS a
  INNER JOIN dbo.jobs AS j ON j.id = a.job_id
  INNER JOIN dbo.users AS u ON u.id = a.candidate_id
  INNER JOIN dbo.companies AS c ON c.id = j.company_id
  LEFT JOIN dbo.interviews AS i ON i.application_id = a.id
  LEFT JOIN dbo.candidate_cvs AS cv ON cv.id = a.cv_id`;

async function findById(id, access) {
  const replacements = { id };
  let accessSql = '';
  if (access.role === 'candidate') {
    replacements.candidateId = access.id;
    accessSql = ' AND a.candidate_id = :candidateId';
  } else if (access.role === 'employer') {
    replacements.recruiterId = access.id;
    accessSql = ' AND j.recruiter_id = :recruiterId';
  }
  const rows = await sequelize.query(`${applicationSelect} WHERE a.id = :id${accessSql}`, {
    replacements,
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function listForUser(user) {
  const replacements = {};
  let where = '';
  if (user.role === 'candidate') {
    replacements.candidateId = user.id;
    where = ' WHERE a.candidate_id = :candidateId';
  } else if (user.role === 'employer') {
    replacements.recruiterId = user.id;
    where = ' WHERE j.recruiter_id = :recruiterId';
  }
  return sequelize.query(`${applicationSelect}${where} ORDER BY a.applied_at DESC, a.id DESC`, {
    replacements,
    type: QueryTypes.SELECT,
  });
}

async function checkForCandidate(jobId, candidateId) {
  const rows = await sequelize.query(`
    SELECT
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.applications
        WHERE job_id = :jobId AND candidate_id = :candidateId
          AND status NOT IN (N'withdrawn', N'employment_ended')
      ) THEN 1 ELSE 0 END AS bit) AS hasApplied,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.applications AS activeApplication
        INNER JOIN dbo.jobs AS activeJob ON activeJob.id = activeApplication.job_id
        WHERE activeApplication.candidate_id = :candidateId
          AND activeApplication.status IN (N'accepted', N'hired')
          AND activeJob.company_id = targetJob.company_id
      ) THEN 1 ELSE 0 END AS bit) AS blockedByActiveEmployment,
      company.name AS companyName
    FROM dbo.jobs AS targetJob
    INNER JOIN dbo.companies AS company ON company.id = targetJob.company_id
    WHERE targetJob.id = :jobId`, {
    replacements: { jobId, candidateId },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function listForJob(jobId, user) {
  const replacements = { jobId };
  let access = '';
  if (user.role === 'employer') {
    replacements.recruiterId = user.id;
    access = ' AND j.recruiter_id = :recruiterId';
  }
  return sequelize.query(`${applicationSelect} WHERE a.job_id = :jobId${access} ORDER BY a.applied_at DESC, a.id DESC`, {
    replacements,
    type: QueryTypes.SELECT,
  });
}

async function findJobForApplication(jobId, candidateId) {
  const rows = await sequelize.query(`
    SELECT j.id, j.company_id AS companyId, c.name AS companyName,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.applications AS activeApplication
        INNER JOIN dbo.jobs AS activeJob ON activeJob.id = activeApplication.job_id
        WHERE activeApplication.candidate_id = :candidateId
          AND activeApplication.status IN (N'accepted', N'hired')
          AND activeJob.company_id = j.company_id
      ) THEN 1 ELSE 0 END AS bit) AS blockedByActiveEmployment
    FROM dbo.jobs AS j
    INNER JOIN dbo.companies AS c ON c.id = j.company_id
    INNER JOIN dbo.users AS owner ON owner.id = j.recruiter_id
    WHERE j.id = :jobId AND j.status = N'active'
      AND j.admin_visibility = N'visible' AND c.admin_status = N'active' AND owner.admin_locked = 0
      AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())`, {
    replacements: { jobId, candidateId },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function candidateOwnsAvailableCv(cvId, candidateId) {
  const rows = await sequelize.query(`
    SELECT 1 AS found FROM dbo.candidate_cvs
    WHERE id = :cvId AND candidate_id = :candidateId
      AND size_bytes > 0 AND stored_name NOT LIKE N'legacy-missing-%'`, {
    replacements: { cvId, candidateId },
    type: QueryTypes.SELECT,
  });
  return rows.length > 0;
}

async function insertApplication(values) {
  const rows = await sequelize.query(`
    DECLARE @insertedApplication TABLE (id BIGINT);
    INSERT INTO dbo.applications (job_id, candidate_id, cv_text, cv_id, status)
    OUTPUT INSERTED.id INTO @insertedApplication(id)
    VALUES (:jobId, :candidateId, NULLIF(:cv, N''), :cvId, N'applied');
    SELECT id FROM @insertedApplication`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

async function reopenApplication(values) {
  const rows = await sequelize.query(`
    DECLARE @reopenedApplication TABLE (id BIGINT);
    UPDATE dbo.applications
    SET cv_text = NULLIF(:cv, N''), cv_id = :cvId, status = N'applied',
        applied_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
    OUTPUT INSERTED.id INTO @reopenedApplication(id)
    WHERE job_id = :jobId AND candidate_id = :candidateId
      AND status IN (N'withdrawn', N'employment_ended');
    SELECT id FROM @reopenedApplication`, {
    replacements: values,
    type: QueryTypes.SELECT,
  });
  return rows[0]?.id;
}

async function transitionStatus(id, access, status, allowedPreviousStatuses) {
  return sequelize.transaction(async (transaction) => {
    const replacements = { id };
    let accessSql = '';
    if (access.role === 'candidate') {
      replacements.candidateId = access.id;
      accessSql = ' AND a.candidate_id = :candidateId';
    } else if (access.role === 'employer') {
      replacements.recruiterId = access.id;
      accessSql = ' AND j.recruiter_id = :recruiterId';
    }
    const found = await sequelize.query(`
      SELECT a.status FROM dbo.applications a WITH (UPDLOCK, ROWLOCK)
      INNER JOIN dbo.jobs j ON j.id = a.job_id
      WHERE a.id = :id${accessSql}`, {
      replacements,
      type: QueryTypes.SELECT,
      transaction,
    });
    const currentStatus = found[0]?.status;
    if (!currentStatus) return { found: false };
    if (!allowedPreviousStatuses.includes(currentStatus)) return { found: true, currentStatus, changed: false };

    await sequelize.query(`
      UPDATE dbo.applications SET status = :status, updated_at = SYSUTCDATETIME()
      WHERE id = :id`, {
      replacements: { id, status },
      transaction,
    });
    return { found: true, currentStatus, changed: true };
  });
}

async function withdraw(id, candidateId) {
  const rows = await sequelize.query(`
    UPDATE dbo.applications SET status = N'withdrawn', updated_at = SYSUTCDATETIME()
    WHERE id = :id AND candidate_id = :candidateId
      AND status IN (N'applied', N'reviewing', N'interview_invited', N'interviewed', N'offered', N'offer_accepted');
    SELECT @@ROWCOUNT AS affected`, {
    replacements: { id, candidateId },
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.affected || 0);
}

module.exports = {
  findById,
  listForUser,
  checkForCandidate,
  listForJob,
  findJobForApplication,
  candidateOwnsAvailableCv,
  insertApplication,
  reopenApplication,
  transitionStatus,
  withdraw,
};
