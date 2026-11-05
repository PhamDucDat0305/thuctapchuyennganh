/* ========== SQL SERVER SESSION AUTHENTICATION ========== */
import { apiRequest } from "./api.js";

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_KEEPALIVE_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = "jvLastActivityAt";
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "click"];
let idleTimeoutHandle = null;
let keepaliveHandle = null;
let lastActivityAt = 0;
let lastActivitySavedAt = 0;
let activityListenersInstalled = false;

function storedActivityTime() {
  const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) ? value : 0;
}

function isSessionIdle() {
  lastActivityAt = Math.max(lastActivityAt, storedActivityTime());
  return Date.now() - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS;
}

function scheduleIdleLogout() {
  clearTimeout(idleTimeoutHandle);
  const remaining = SESSION_IDLE_TIMEOUT_MS - (Date.now() - Math.max(lastActivityAt, storedActivityTime()));
  if (remaining <= 0) {
    window.Auth.logout();
    return;
  }
  idleTimeoutHandle = setTimeout(() => window.Auth.logout(), remaining);
}

function recordUserActivity() {
  if (!window.Auth?.getCurrentUser()) return;
  lastActivityAt = Date.now();
  if (lastActivityAt - lastActivitySavedAt >= 10_000) {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityAt));
    lastActivitySavedAt = lastActivityAt;
  }
  scheduleIdleLogout();
}

function handleSessionStorage(event) {
  if (event.key === LAST_ACTIVITY_KEY) {
    lastActivityAt = Math.max(lastActivityAt, Number(event.newValue) || 0);
    scheduleIdleLogout();
  } else if (event.key === "currentUser") {
    if (!event.newValue) {
      stopSessionIdleMonitor();
      sessionStorage.removeItem("loggedInUser");
      const authPath = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/")
        ? "../auth.html"
        : "auth.html";
      window.location.href = authPath;
    } else {
      startSessionIdleMonitor();
    }
  }
}

function handleVisibilityChange() {
  if (document.visibilityState !== "visible") return;
  if (isSessionIdle()) {
    window.Auth.logout();
    return;
  }
  recordUserActivity();
}

function stopSessionIdleMonitor() {
  clearTimeout(idleTimeoutHandle);
  clearInterval(keepaliveHandle);
  idleTimeoutHandle = null;
  keepaliveHandle = null;
  if (!activityListenersInstalled) return;
  ACTIVITY_EVENTS.forEach((eventName) => document.removeEventListener(eventName, recordUserActivity));
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleVisibilityChange);
  window.removeEventListener("storage", handleSessionStorage);
  activityListenersInstalled = false;
}

function startSessionIdleMonitor(resetActivity = false) {
  if (!window.Auth?.getCurrentUser()) return;
  const now = Date.now();
  const stored = storedActivityTime();
  if (resetActivity || !stored) {
    lastActivityAt = now;
    lastActivitySavedAt = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } else {
    lastActivityAt = Math.max(lastActivityAt, stored);
    lastActivitySavedAt = stored;
  }

  if (isSessionIdle()) {
    window.Auth.logout();
    return;
  }
  if (!activityListenersInstalled) {
    ACTIVITY_EVENTS.forEach((eventName) => document.addEventListener(eventName, recordUserActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("storage", handleSessionStorage);
    activityListenersInstalled = true;
  }
  scheduleIdleLogout();
  clearInterval(keepaliveHandle);
  keepaliveHandle = setInterval(async () => {
    if (!window.Auth?.getCurrentUser()) {
      stopSessionIdleMonitor();
      return;
    }
    if (isSessionIdle()) {
      window.Auth.logout();
      return;
    }
    try {
      await apiRequest("/me");
    } catch (error) {
      if (error.status === 401) window.Auth.logout();
    }
  }, SESSION_KEEPALIVE_MS);
}

/**
 * Authentication management object
 */
window.Auth = {
  /**
   * Register through Express; the API creates the SQL Server session.
   */
  async sendEmailCode(email) {
    try {
      const result = await apiRequest("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return { success: true, message: result.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  async verifyEmailCode(email, code) {
    try {
      const result = await apiRequest("/auth/email/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  async register(password, fullName, email, role, companyName = "", verificationToken = "") {
    try {
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          verificationToken,
          ...(role === "employer" ? { companyName: companyName.trim() } : {}),
        }),
      });
      localStorage.setItem("currentUser", JSON.stringify(result.user));
      startSessionIdleMonitor(true);
      return { success: true, user: result.user };
    } catch (error) {
      console.error("Auth: register error", error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Log in through Express and store the non-secret user summary.
   */
  async login(email, password) {
    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("currentUser", JSON.stringify(result.user));
      startSessionIdleMonitor(true);
      return { success: true, user: result.user };
    } catch (error) {
      console.error("Auth: login error", error);
      return { success: false, message: error.message || "Email hoặc mật khẩu không chính xác." };
    }
  },

  /**
   * Log out current user
   */
  async logout() {
    stopSessionIdleMonitor();
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Auth: logout error", error);
    } finally {
      localStorage.removeItem("currentUser");
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      sessionStorage.removeItem("loggedInUser");

      // Redirect to auth page based on folder depth
      const isSubfolder = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
      window.location.href = isSubfolder ? "../auth.html" : "auth.html";
    }
  },

  /**
   * Get current logged-in user from local storage
   */
  getCurrentUser() {
    try {
      const local = localStorage.getItem("currentUser");
      return local ? JSON.parse(local) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  /**
   * Update current user session data
   */
  updateSession(userData) {
    const current = this.getCurrentUser();
    if (current) {
      const updated = { ...current, ...userData };
      localStorage.setItem("currentUser", JSON.stringify(updated));
    }
  },

  /**
   * Check authentication and role requirements for a page
   * Redirects if requirements are not met
   */
  requireAuth(allowedRoles = null) {
    const user = this.getCurrentUser();
    const isSubfolder = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    const authPath = isSubfolder ? "../auth.html" : "auth.html";
    const indexPath = isSubfolder ? "../index.html" : "index.html";

    // Immediate hide to prevent flicker
    if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
      document.documentElement.style.display = "none";
    }

    if (!user) {
      stopSessionIdleMonitor();
      window.location.href = authPath;
      return null;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      alert("Bạn không có quyền truy cập trang này!");
      window.location.href = indexPath;
      return null;
    }

    document.documentElement.style.display = "";
    // Verify the cookie-backed session on the server; localStorage is only UI cache.
    apiRequest("/me").then(({ user: current }) => {
      localStorage.setItem("currentUser", JSON.stringify(current));
      startSessionIdleMonitor();
      if (allowedRoles && !allowedRoles.includes(current.role)) {
        localStorage.removeItem("currentUser");
        window.location.href = indexPath;
      }
    }).catch(() => {
      stopSessionIdleMonitor();
      localStorage.removeItem("currentUser");
      window.location.href = authPath;
    });
    return user;
  },
};

startSessionIdleMonitor();
