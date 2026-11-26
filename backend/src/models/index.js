const { DataTypes } = require('sequelize');
const { createSequelize } = require('../config/sequelize');

const sequelize = createSequelize();

const User = require('./user.model')(sequelize, DataTypes);
const Company = require('./company.model')(sequelize, DataTypes);
const Job = require('./job.model')(sequelize, DataTypes);
const CandidateCv = require('./candidate-cv.model')(sequelize, DataTypes);
const CandidateProfile = require('./candidate-profile.model')(sequelize, DataTypes);
const CoverLetter = require('./cover-letter.model')(sequelize, DataTypes);
const Application = require('./application.model')(sequelize, DataTypes);
const Interview = require('./interview.model')(sequelize, DataTypes);
const Invite = require('./invite.model')(sequelize, DataTypes);
const Message = require('./message.model')(sequelize, DataTypes);
const SavedJob = require('./saved-job.model')(sequelize, DataTypes);
const EmployerSavedCandidate = require('./employer-saved-candidate.model')(sequelize, DataTypes);
const ProfileView = require('./profile-view.model')(sequelize, DataTypes);
const JobReport = require('./job-report.model')(sequelize, DataTypes);
const AdminAuditLog = require('./admin-audit-log.model')(sequelize, DataTypes);
const EmailVerification = require('./email-verification.model')(sequelize, DataTypes);
const SessionRecord = require('./session-record.model')(sequelize, DataTypes);

// Associations support reads/navigation. Constraints stay managed by the existing SQL schema.
User.hasOne(Company, { as: 'company', foreignKey: 'employerId', constraints: false });
Company.belongsTo(User, { as: 'employer', foreignKey: 'employerId', constraints: false });
User.hasOne(CandidateProfile, { as: 'candidateProfile', foreignKey: 'userId', constraints: false });
CandidateProfile.belongsTo(User, { as: 'user', foreignKey: 'userId', constraints: false });
User.hasMany(CandidateCv, { as: 'cvs', foreignKey: 'candidateId', constraints: false });
CandidateCv.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
User.hasMany(CoverLetter, { as: 'coverLetters', foreignKey: 'candidateId', constraints: false });
CoverLetter.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });

Company.hasMany(Job, { as: 'jobs', foreignKey: 'companyId', constraints: false });
Job.belongsTo(Company, { as: 'company', foreignKey: 'companyId', constraints: false });
Job.belongsTo(User, { as: 'recruiter', foreignKey: 'recruiterId', constraints: false });

User.hasMany(Application, { as: 'applications', foreignKey: 'candidateId', constraints: false });
Application.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
Job.hasMany(Application, { as: 'applications', foreignKey: 'jobId', constraints: false });
Application.belongsTo(Job, { as: 'job', foreignKey: 'jobId', constraints: false });
CandidateCv.hasMany(Application, { as: 'applications', foreignKey: 'cvId', constraints: false });
Application.belongsTo(CandidateCv, { as: 'cv', foreignKey: 'cvId', constraints: false });

Application.hasMany(Interview, { as: 'interviews', foreignKey: 'applicationId', constraints: false });
Interview.belongsTo(Application, { as: 'application', foreignKey: 'applicationId', constraints: false });

User.hasMany(Invite, { as: 'receivedInvites', foreignKey: 'candidateId', constraints: false });
User.hasMany(Invite, { as: 'sentInvites', foreignKey: 'employerId', constraints: false });
Invite.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
Invite.belongsTo(User, { as: 'employer', foreignKey: 'employerId', constraints: false });
Invite.belongsTo(Job, { as: 'job', foreignKey: 'jobId', constraints: false });

User.hasMany(Message, { as: 'sentMessages', foreignKey: 'senderId', constraints: false });
User.hasMany(Message, { as: 'receivedMessages', foreignKey: 'receiverId', constraints: false });
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId', constraints: false });
Message.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId', constraints: false });

User.hasMany(SavedJob, { as: 'savedJobs', foreignKey: 'candidateId', constraints: false });
SavedJob.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
Job.hasMany(SavedJob, { as: 'savedByCandidates', foreignKey: 'jobId', constraints: false });
SavedJob.belongsTo(Job, { as: 'job', foreignKey: 'jobId', constraints: false });
User.hasMany(EmployerSavedCandidate, { as: 'savedCandidates', foreignKey: 'employerId', constraints: false });
EmployerSavedCandidate.belongsTo(User, { as: 'employer', foreignKey: 'employerId', constraints: false });
EmployerSavedCandidate.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
User.hasMany(ProfileView, { as: 'profileViewsReceived', foreignKey: 'candidateId', constraints: false });
ProfileView.belongsTo(User, { as: 'candidate', foreignKey: 'candidateId', constraints: false });
ProfileView.belongsTo(User, { as: 'employer', foreignKey: 'employerId', constraints: false });
Job.hasMany(JobReport, { as: 'reports', foreignKey: 'jobId', constraints: false });
JobReport.belongsTo(Job, { as: 'job', foreignKey: 'jobId', constraints: false });
User.hasMany(JobReport, { as: 'jobReports', foreignKey: 'reporterId', constraints: false });
JobReport.belongsTo(User, { as: 'reporter', foreignKey: 'reporterId', constraints: false });
User.hasMany(AdminAuditLog, { as: 'adminActions', foreignKey: 'adminId', constraints: false });
AdminAuditLog.belongsTo(User, { as: 'admin', foreignKey: 'adminId', constraints: false });

module.exports = {
  sequelize,
  User,
  Company,
  Job,
  CandidateCv,
  CandidateProfile,
  CoverLetter,
  Application,
  Interview,
  Invite,
  Message,
  SavedJob,
  EmployerSavedCandidate,
  ProfileView,
  JobReport,
  AdminAuditLog,
  EmailVerification,
  SessionRecord,
};
