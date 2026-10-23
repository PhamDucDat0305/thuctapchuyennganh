/* ========== SQL SERVER SESSION AUTHENTICATION ========== */
import { apiRequest } from "./api.js";

/**
 * Authentication management object
 */
window.Auth = {
  /**
   * Register through Express; the API creates the SQL Server session.
   */
  async register(password, fullName, email, role) {
    try {
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          // The current registration form has no separate company name field.
          ...(role === "employer" ? { companyName: `${fullName} Company` } : {}),
        }),
      });
      localStorage.setItem("currentUser", JSON.stringify(result.user));
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
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Auth: logout error", error);
    } finally {
      localStorage.removeItem("currentUser");
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
      if (allowedRoles && !allowedRoles.includes(current.role)) {
        localStorage.removeItem("currentUser");
        window.location.href = indexPath;
      }
    }).catch(() => {
      localStorage.removeItem("currentUser");
      window.location.href = authPath;
    });
    return user;
  },
};
