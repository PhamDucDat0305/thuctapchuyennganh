const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const select = `SELECT i.id, i.application_id AS applicationId,
  CONVERT(char(10), i.interview_date, 23) AS date,
  CONVERT(char(5), i.interview_time, 108) AS time,
  i.interview_type AS type, i.notes, i.status,
  i.created_at AS createdAt, i.updated_at AS updatedAt,
  a.candidate_id AS candidateId, u.full_name AS fullName,
  a.status AS applicationStatus, j.recruiter_id AS createdBy,
  j.title AS jobTitle, c.id AS companyId, c.name AS companyName
  FROM dbo.interviews i
  INNER JOIN dbo.applications a ON a.id = i.application_id
  INNER JOIN dbo.users u ON u.id = a.candidate_id
  INNER JOIN dbo.jobs j ON j.id = a.job_id
  INNER JOIN dbo.companies c ON c.id = j.company_id`;

function access(user) {
  if (user.role === 'candidate') return { sql: ' AND a.candidate_id = :userId', replacements: { userId: user.id } };
  if (user.role === 'employer') return { sql: ' AND j.recruiter_id = :userId', replacements: { userId: user.id } };
  return { sql: '', replacements: {} };
}

async function list(user) {
  const scope = access(user);
  return sequelize.query(`${select} WHERE 1=1${scope.sql} ORDER BY i.interview_date, i.interview_time`, { replacements: scope.replacements, type: QueryTypes.SELECT });
}

async function findForApplication(applicationId, user) {
  const scope = access(user);
  const rows = await sequelize.query(`${select} WHERE i.application_id = :applicationId${scope.sql}`, {
    replacements: { applicationId, ...scope.replacements }, type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function schedule({ applicationId, recruiterId, date, time, type, notes }) {
  return sequelize.transaction(async (transaction) => {
    const owned = await sequelize.query(`SELECT a.id FROM dbo.applications a
      INNER JOIN dbo.jobs j ON j.id = a.job_id
      WHERE a.id = :applicationId AND j.recruiter_id = :recruiterId
        AND a.status IN (N'applied', N'reviewing', N'interview_invited')`, {
      replacements: { applicationId, recruiterId }, type: QueryTypes.SELECT, transaction,
    });
    if (!owned.length) return null;
    await sequelize.query(`
      IF EXISTS (SELECT 1 FROM dbo.interviews WITH (UPDLOCK, HOLDLOCK) WHERE application_id = :applicationId)
        UPDATE dbo.interviews SET interview_date = :date, interview_time = CONVERT(time(0), :time, 108),
          scheduled_at = DATEADD(MINUTE, DATEDIFF(MINUTE, CONVERT(time(0), '00:00'), CONVERT(time(0), :time, 108)), CONVERT(datetime2(0), :date)),
          interview_type = :type, notes = :notes, status = N'scheduled', updated_at = SYSUTCDATETIME()
        WHERE application_id = :applicationId;
      ELSE
        INSERT INTO dbo.interviews (application_id, interview_date, interview_time, scheduled_at, interview_type, notes)
        VALUES (:applicationId, :date, CONVERT(time(0), :time, 108),
          DATEADD(MINUTE, DATEDIFF(MINUTE, CONVERT(time(0), '00:00'), CONVERT(time(0), :time, 108)), CONVERT(datetime2(0), :date)), :type, :notes);
      UPDATE dbo.applications SET status = N'interview_invited', updated_at = SYSUTCDATETIME() WHERE id = :applicationId`, {
      replacements: { applicationId, date, time, type, notes: notes || null }, transaction,
    });
    const rows = await sequelize.query(`${select} WHERE i.application_id = :applicationId AND j.recruiter_id = :recruiterId`, {
      replacements: { applicationId, recruiterId }, type: QueryTypes.SELECT, transaction,
    });
    return rows[0] || null;
  });
}

async function decide({ id, recruiterId, decision }) {
  return sequelize.transaction(async (transaction) => {
    const rows = await sequelize.query(`SELECT i.status AS interviewStatus, a.id AS applicationId, a.status AS applicationStatus
      FROM dbo.interviews i WITH (UPDLOCK, ROWLOCK)
      INNER JOIN dbo.applications a ON a.id=i.application_id INNER JOIN dbo.jobs j ON j.id=a.job_id
      WHERE i.id=:id AND j.recruiter_id=:recruiterId`, {
      replacements: { id, recruiterId }, type: QueryTypes.SELECT, transaction,
    });
    const row = rows[0];
    if (!row) return { error: 'not_found' };
    if (!['scheduled', 'confirmed'].includes(row.interviewStatus)
      || !['interview_invited', 'interviewed'].includes(row.applicationStatus)) return { error: 'conflict' };
    await sequelize.query(`UPDATE dbo.interviews SET status=N'completed', updated_at=SYSUTCDATETIME() WHERE id=:id;
      UPDATE dbo.applications SET status=:decision, updated_at=SYSUTCDATETIME() WHERE id=:applicationId`, {
      replacements: { id, applicationId: row.applicationId, decision }, transaction,
    });
    return { ok: true, decision, interviewStatus: 'completed' };
  });
}

async function updateStatus({ id, user, status }) {
  return sequelize.transaction(async (transaction) => {
    const scope = access(user);
    const rows = await sequelize.query(`SELECT i.status AS interviewStatus, a.id AS applicationId
      FROM dbo.interviews i WITH (UPDLOCK, ROWLOCK) INNER JOIN dbo.applications a ON a.id=i.application_id
      INNER JOIN dbo.jobs j ON j.id=a.job_id WHERE i.id=:id${scope.sql}`, {
      replacements: { id, ...scope.replacements }, type: QueryTypes.SELECT, transaction,
    });
    const row = rows[0];
    if (!row) return { error: 'not_found' };
    const candidateOk = user.role !== 'candidate' || row.interviewStatus === 'scheduled';
    const employerOk = user.role !== 'employer'
      || (status === 'no_show' && ['scheduled', 'confirmed'].includes(row.interviewStatus))
      || (status === 'canceled' && !['completed', 'canceled'].includes(row.interviewStatus));
    if (!candidateOk || !employerOk) return { error: 'conflict' };
    await sequelize.query(`UPDATE dbo.interviews SET status=:status, updated_at=SYSUTCDATETIME() WHERE id=:id`, {
      replacements: { id, status }, transaction,
    });
    if (user.role === 'employer' && status === 'canceled') {
      await sequelize.query(`UPDATE dbo.applications SET status=N'reviewing', updated_at=SYSUTCDATETIME()
        WHERE id=:applicationId AND status=N'interview_invited'`, { replacements: { applicationId: row.applicationId }, transaction });
    }
    return { ok: true, status };
  });
}

module.exports = { list, findForApplication, schedule, decide, updateStatus };
