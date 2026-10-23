const express = require('express');
const { createSessionMiddleware, connectSessionStore, closeSessionStore } = require('./config/session');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const meRoutes = require('./routes/me.routes');
const jobsRoutes = require('./routes/jobs.routes');
const employerJobsRoutes = require('./routes/employer-jobs.routes');
const applicationsRoutes = require('./routes/applications.routes');
const interviewsRoutes = require('./routes/interviews.routes');
const statsRoutes = require('./routes/stats.routes');
const usersRoutes = require('./routes/users.routes');
const employerCompanyRoutes = require('./routes/employer-company.routes');
const savedJobsRoutes = require('./routes/saved-jobs.routes');
const messagesRoutes = require('./routes/messages.routes');
const invitesRoutes = require('./routes/invites.routes');
const profileViewsRoutes = require('./routes/profile-views.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Cookie sessions require credentialed CORS when the static frontend runs on
// another local development port (for example Live Server on :5500).
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5500,http://localhost:5501,http://127.0.0.1:5500,http://127.0.0.1:5501')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.includes(origin) ? 403 : 204);
  next();
});

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(createSessionMiddleware());

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/employer/jobs', employerJobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/interviews', interviewsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/employer/company', employerCompanyRoutes);
app.use('/api/saved-jobs', savedJobsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/profile-views', profileViewsRoutes);

// Các nhóm route nghiệp vụ khác (profile...) sẽ được thêm ở đây.

app.use(notFound);
app.use(errorHandler);

app.locals.closeSessionStore = closeSessionStore;
app.locals.connectSessionStore = connectSessionStore;

module.exports = app;
