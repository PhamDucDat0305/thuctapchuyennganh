const express = require('express');
const path = require('node:path');
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
const frontendRoot = path.resolve(__dirname, '..', '..');

// Keep credentialed CORS for optional external frontend origins such as Live
// Server. The normal single-server setup is same-origin and does not need CORS.
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

// Only expose known frontend directories. Do not mount the project root:
// backend source/config, SQL, reports, docs, .env and .git must stay private.
for (const directory of ['css', 'js', 'ico', 'candidate', 'employer']) {
  app.use(`/${directory}`, express.static(path.join(frontendRoot, directory), {
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
  }));
}

// Serve only known root-level HTML pages plus short, optional aliases. Keep
// the existing *.html URLs working and avoid a catch-all SPA fallback so API
// and unknown routes retain JSON 404 responses.
const frontendPages = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/about': 'about.html',
  '/about.html': 'about.html',
  '/contact': 'contact.html',
  '/contact.html': 'contact.html',
  '/auth': 'auth.html',
  '/auth.html': 'auth.html',
  '/jobs': 'job-list.html',
  '/job-list.html': 'job-list.html',
  '/job-list': 'job-list.html',
  '/job-detail': 'job-detail.html',
  '/job-detail.html': 'job-detail.html',
  '/favicon.ico': 'ico/favicon.ico',
  '/browserconfig.xml': 'ico/browserconfig.xml',
  '/LabThucHanh.html': 'LabThucHanh.html',
};
for (const [route, file] of Object.entries(frontendPages)) {
  app.get(route, (req, res, next) => {
    res.sendFile(path.join(frontendRoot, file), { dotfiles: 'deny' }, (error) => {
      if (error) next(error);
    });
  });
}

app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
// Health checks must work independently of the SQL-backed session store.
app.use(createSessionMiddleware());

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
