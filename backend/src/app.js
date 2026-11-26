const express = require("express");
const path = require("node:path");
const {
  createSessionMiddleware,
  connectSessionStore,
  closeSessionStore,
} = require("./config/session");
const healthRoutes = require("./routes/health.routes");
const testRoutes = require("./routes/test.routes");
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
const publicRoot = path.join(frontendRoot, "public");

app.disable("x-powered-by");

// Only public/ is exposed. Keep backend, SQL, docs, .env, private uploads,
// reports and .git outside this directory.
app.use(express.static(publicRoot, {
  dotfiles: "deny",
  fallthrough: true,
  index: false,
}));

// Preserve short aliases while the actual frontend files live under public/.
const frontendPages = {
  "/": "index.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/auth": "auth.html",
  "/jobs": "job-list.html",
  "/job-list": "job-list.html",
  "/job-detail": "job-detail.html",
  "/favicon.ico": "ico/favicon.ico",
  "/browserconfig.xml": "ico/browserconfig.xml",
};
for (const [route, file] of Object.entries(frontendPages)) {
  app.get(route, (req, res, next) => {
    res.sendFile(
      path.join(publicRoot, file),
      { dotfiles: "deny" },
      (error) => {
        if (error) next(error);
      },
    );
  });
}

app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRoutes);
app.use("/api/test", testRoutes);
const sessionMiddleware = createSessionMiddleware();
app.use(sessionMiddleware);
app.locals.sessionMiddleware = sessionMiddleware;

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

app.use(notFound);
app.use(errorHandler);

app.locals.closeSessionStore = closeSessionStore;
app.locals.connectSessionStore = connectSessionStore;

module.exports = app;
