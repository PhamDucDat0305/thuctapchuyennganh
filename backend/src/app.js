const express = require("express");
const path = require("node:path");
const {
  createSessionMiddleware,
  connectSessionStore,
  closeSessionStore,
} = require("./config/session");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const meRoutes = require("./routes/me.routes");
const jobsRoutes = require("./routes/jobs.routes");
const employerJobsRoutes = require("./routes/employer-jobs.routes");
const applicationsRoutes = require("./routes/applications.routes");
const interviewsRoutes = require("./routes/interviews.routes");
const statsRoutes = require("./routes/stats.routes");
const usersRoutes = require("./routes/users.routes");
const employerCompanyRoutes = require("./routes/employer-company.routes");
const savedJobsRoutes = require("./routes/saved-jobs.routes");
const messagesRoutes = require("./routes/messages.routes");
const invitesRoutes = require("./routes/invites.routes");
const profileViewsRoutes = require("./routes/profile-views.routes");
const companiesRoutes = require("./routes/companies.routes");
const adminRoutes = require("./routes/admin.routes");
const jobReportsRoutes = require("./routes/job-reports.routes");
const employerSavedCandidatesRoutes = require("./routes/employer-saved-candidates.routes");
const candidateContentRoutes = require("./routes/candidate-content.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const frontendRoot = path.resolve(__dirname, "..", "..");

app.disable("x-powered-by");

// Only expose known frontend directories. Do not mount the project root:
// backend source/config, SQL, reports, docs, .env and .git must stay private.
for (const directory of ["css", "js", "ico", "candidate", "employer", "admin"]) {
  app.use(
    `/${directory}`,
    express.static(path.join(frontendRoot, directory), {
      dotfiles: "deny",
      fallthrough: true,
      index: false,
    }),
  );
}

// Serve only known root-level HTML pages plus short, optional aliases. Keep
// the existing *.html URLs working and avoid a catch-all SPA fallback so API
// and unknown routes retain JSON 404 responses.
const frontendPages = {
  "/": "index.html",
  "/index.html": "index.html",
  "/about": "about.html",
  "/about.html": "about.html",
  "/contact": "contact.html",
  "/contact.html": "contact.html",
  "/auth": "auth.html",
  "/auth.html": "auth.html",
  "/jobs": "job-list.html",
  "/job-list.html": "job-list.html",
  "/job-list": "job-list.html",
  "/job-detail": "job-detail.html",
  "/job-detail.html": "job-detail.html",
  "/company-profile.html": "company-profile.html",
  "/favicon.ico": "ico/favicon.ico",
  "/browserconfig.xml": "ico/browserconfig.xml",
};
for (const [route, file] of Object.entries(frontendPages)) {
  app.get(route, (req, res, next) => {
    res.sendFile(
      path.join(frontendRoot, file),
      { dotfiles: "deny" },
      (error) => {
        if (error) next(error);
      },
    );
  });
}

app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRoutes);
app.use(createSessionMiddleware());

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/employer/jobs", employerJobsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/interviews", interviewsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/employer/company", employerCompanyRoutes);
app.use("/api/saved-jobs", savedJobsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/invites", invitesRoutes);
app.use("/api/profile-views", profileViewsRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/job-reports", jobReportsRoutes);
app.use("/api/employer/saved-candidates", employerSavedCandidatesRoutes);
app.use("/api/candidate-content", candidateContentRoutes);

// Các nhóm route nghiệp vụ khác (profile...) sẽ được thêm ở đây.

app.use(notFound);
app.use(errorHandler);

app.locals.closeSessionStore = closeSessionStore;
app.locals.connectSessionStore = connectSessionStore;

module.exports = app;
