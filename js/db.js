/* ========== DATABASE LAYER (Firestore) ========== */
import { db } from "./firebase-config.js";
import { apiRequest } from "./api.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  increment
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Expose onSnapshot for internal use (mostly in app.js or page scripts)
window.FirebaseFirestore = { onSnapshot };

/**
 * Database utility object for Firestore interactions
 */
window.DB = {
  /* ================= USERS ================= */

  /**
   * Fetch all users
   */
  async getUsers() {
    try {
      return await apiRequest("/users/candidates");
    } catch (error) {
      console.error("DB: getUsers error", error);
      return [];
    }
  },

  /**
   * Fetch user by ID
   */
  async getUserById(userId) {
    if (!userId) return null;
    try {
      return await apiRequest(`/users/${encodeURIComponent(userId)}`);
    } catch (error) {
      if (error.status === 404) return null;
      console.error(`DB: getUserById error for ${userId}`, error);
      throw error;
    }
  },

  /**
   * Update user data
   */
  async updateUser(userId, data) {
    try {
      const result = await apiRequest("/me/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return result.user;
    } catch (error) {
      console.error(`DB: updateUser error for ${userId}`, error);
      throw error;
    }
  },

  /* ================= JOBS ================= */

  /**
   * Fetch all active jobs
   */
  async getJobs() {
    try {
      return await apiRequest("/jobs");
    } catch (error) {
      console.error("DB: getJobs error", error);
      throw error;
    }
  },

  /**
   * Fetch job by ID
   */
  async getJobById(jobId) {
    if (!jobId) return null;
    try {
      return await apiRequest(`/jobs/${encodeURIComponent(jobId)}`);
    } catch (error) {
      if (error.status === 404) return null;
      // Keep old Firestore-linked application pages readable during migration.
      if (error.status === 400) {
        const legacyDoc = await getDoc(doc(db, "jobs", jobId));
        return legacyDoc.exists() ? { id: legacyDoc.id, ...legacyDoc.data() } : null;
      }
      console.error(`DB: getJobById error for ${jobId}`, error);
      throw error;
    }
  },

  /**
   * Fetch jobs created by a specific employer
   */
  async getJobsByEmployer(employerId) {
    if (!employerId) return [];
    try {
      return await apiRequest("/employer/jobs");
    } catch (error) {
      console.error(`DB: getJobsByEmployer error for ${employerId}`, error);
      throw error;
    }
  },

  /**
   * Create a new job listing
   */
  async createJob(data) {
    try {
      return await apiRequest("/employer/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("DB: createJob error", error);
      throw error;
    }
  },

  /**
   * Update an existing job
   */
  async updateJob(jobId, data) {
    try {
      return await apiRequest(`/employer/jobs/${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`DB: updateJob error for ${jobId}`, error);
      throw error;
    }
  },

  /**
   * Delete a job listing
   */
  async deleteJob(jobId) {
    try {
      return await apiRequest(`/employer/jobs/${encodeURIComponent(jobId)}/close`, {
        method: "PATCH",
      });
    } catch (error) {
      console.error(`DB: deleteJob error for ${jobId}`, error);
      throw error;
    }
  },

  /**
   * Increment view counter for a job (atomic)
   */
  async incrementJobViews(jobId) {
    if (!/^[1-9]\d*$/.test(String(jobId))) return;
    try {
      const viewedKey = `job_view_counted_${jobId}`;
      if (sessionStorage.getItem(viewedKey)) return { counted: false, duplicate: true };
      const result = await apiRequest(`/jobs/${encodeURIComponent(jobId)}/view`, { method: "POST" });
      if (result.counted) sessionStorage.setItem(viewedKey, "1");
      return result;
    } catch (error) {
      console.warn(`DB: incrementJobViews error for ${jobId}`, error);
    }
  },

  /* ================= APPLICATIONS ================= */

  /**
   * Fetch all applications
   */
  async getApplications() {
    try {
      if (!localStorage.getItem("currentUser")) return [];
      return await apiRequest("/applications");
    } catch (error) {
      console.error("DB: getApplications error", error);
      return [];
    }
  },

  async getPublicStats() {
    return await apiRequest("/stats");
  },

  /**
   * Fetch application by ID
   */
  async getApplicationById(applicationId) {
    if (!applicationId) return null;
    try {
      return await apiRequest(`/applications/${encodeURIComponent(applicationId)}`);
    } catch (error) {
      if (error.status === 404) return null;
      if (error.status === 400) {
        const legacyDoc = await getDoc(doc(db, "applications", applicationId));
        return legacyDoc.exists() ? { id: legacyDoc.id, ...legacyDoc.data() } : null;
      }
      console.error(`DB: getApplicationById error for ${applicationId}`, error);
      throw error;
    }
  },

  /**
   * Fetch applications for a specific job
   */
  async getApplicationsByJob(jobId) {
    if (!jobId) return [];
    try {
      return await apiRequest(`/applications/job/${encodeURIComponent(jobId)}`);
    } catch (error) {
      console.error(`DB: getApplicationsByJob error for ${jobId}`, error);
      throw error;
    }
  },

  /**
   * Fetch applications submitted by a candidate
   */
  async getApplicationsByCandidate(candidateId) {
    if (!candidateId) return [];
    try {
      return await apiRequest("/applications");
    } catch (error) {
      console.error(`DB: getApplicationsByCandidate error for ${candidateId}`, error);
      throw error;
    }
  },

  /**
   * Check if a candidate has already applied to a job
   */
  async hasApplied(jobId, candidateId) {
    if (!jobId || !candidateId) return false;
    try {
      const result = await apiRequest(`/applications/check/${encodeURIComponent(jobId)}`);
      return result.hasApplied;
    } catch (error) {
      console.error(`DB: hasApplied error for ${jobId}`, error);
      throw error;
    }
  },

  /**
   * Create a new job application
   */
  async createApplication(data) {
    try {
      return await apiRequest("/applications", {
        method: "POST",
        body: JSON.stringify({ jobId: data.jobId, cv: data.cv }),
      });
    } catch (error) {
      console.error("DB: createApplication error", error);
      throw error;
    }
  },

  /**
   * Realtime listener for recruiter's applications
   */
  onApplicationsByRecruiter(recruiterId, callback) {
    if (!recruiterId) return () => {};
    return this._pollApplications(callback);
  },

  /**
   * Realtime listener for candidate's applications
   */
  onApplicationsByCandidate(candidateId, callback) {
    if (!candidateId) return () => {};
    return this._pollApplications(callback);
  },

  _pollApplications(callback) {
    let stopped = false;
    let busy = false;
    const refresh = async () => {
      if (stopped || busy) return;
      busy = true;
      try {
        callback(await apiRequest("/applications"));
      } catch (error) {
        console.error("DB: polling applications error", error);
      } finally {
        busy = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  },

  async updateApplication(applicationId, data) {
    try {
      return await apiRequest(`/applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status }),
      });
    } catch (error) {
      console.error(`DB: updateApplication error for ${applicationId}`, error);
      throw error;
    }
  },

  /**
   * Delete an application (Cancel application)
   */
  async deleteApplication(applicationId) {
    try {
      return await apiRequest(`/applications/${encodeURIComponent(applicationId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error(`DB: deleteApplication error for ${applicationId}`, error);
      throw error;
    }
  },

  /* ================= INTERVIEWS ================= */

  /**
   * Fetch all scheduled interviews
   */
  async getInterviews() {
    try {
      if (!localStorage.getItem("currentUser")) return [];
      return await apiRequest("/interviews");
    } catch (error) {
      console.error("DB: getInterviews error", error);
      throw error;
    }
  },

  /**
   * Fetch interview details for an application
   */
  async getInterviewByApplication(applicationId) {
    if (!applicationId) return null;
    try {
      return await apiRequest(`/interviews/application/${encodeURIComponent(applicationId)}`);
    } catch (error) {
      if (error.status === 404) return null;
      console.error(`DB: getInterviewByApplication error for ${applicationId}`, error);
      throw error;
    }
  },

  /**
   * Schedule a new interview
   */
  async scheduleInterview(applicationId, data) {
    try {
      return await apiRequest("/interviews", {
        method: "POST",
        body: JSON.stringify({ applicationId, ...data }),
      });
    } catch (error) {
      console.error("DB: scheduleInterview error", error);
      throw error;
    }
  },

  /* ================= SAVED JOBS ================= */

  /**
   * Fetch candidate's saved jobs
   */
  async getSavedJobs(userId) {
    try {
      if (!userId) return [];
      return await apiRequest("/saved-jobs");
    } catch (error) {
      console.error("DB: getSavedJobs error", error);
      throw error;
    }
  },

  /** Check whether a candidate has saved a job. */
  async isJobSaved(userId, jobId) {
    if (!userId || !jobId) return false;
    try {
      const result = await apiRequest(`/saved-jobs/check/${encodeURIComponent(jobId)}`);
      return result.saved;
    } catch (error) {
      console.error("DB: isJobSaved error", error);
      throw error;
    }
  },

  /**
   * Toggle job save status (Save/Unsave)
   */
  async toggleSaveJob(userId, jobId) {
    try {
      if (!jobId) throw new Error("Mã công việc không hợp lệ");
      const result = await apiRequest(`/saved-jobs/${encodeURIComponent(jobId)}/toggle`, { method: "POST" });
      return result.saved;
    } catch (error) {
      console.error("DB: toggleSaveJob error", error);
      throw error;
    }
  },

  /* ================= COMPANIES ================= */

  /**
   * Fetch company profile by employer ID
   */
  async getCompanyByEmployer(employerId) {
    if (!employerId) return null;
    try {
      return await apiRequest("/employer/company");
    } catch (error) {
      console.error(`DB: getCompanyByEmployer error for ${employerId}`, error);
      throw error;
    }
  },

  /** Get a job through the employer-only API, including non-public statuses. */
  async getEmployerJobById(jobId) {
    if (!jobId) return null;
    try {
      return await apiRequest(`/employer/jobs/${encodeURIComponent(jobId)}`);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  },

  /**
   * Create or update company profile
   */
  async createCompany(employerId, data) {
    try {
      return await apiRequest("/employer/company", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("DB: createCompany error", error);
      throw error;
    }
  },

  /**
   * Update company details
   */
  async updateCompany(employerId, data) {
    try {
      return await apiRequest("/employer/company", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("DB: updateCompany error", error);
      throw error;
    }
  },

  async changePassword(currentPassword, newPassword) {
    return await apiRequest("/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /* ================= MESSAGES ================= */

  /** Fetch chat history from the SQL Server API. */
  async getMessages(userId, contactId, cursor = null) {
    const query = cursor
      ? `?beforeId=${encodeURIComponent(cursor.beforeId)}&beforeTimestamp=${encodeURIComponent(cursor.beforeTimestamp)}`
      : "";
    return await apiRequest(`/messages/conversation/${encodeURIComponent(contactId)}${query}`);
  },

  /** Send a message; the backend takes sender identity from the session. */
  async sendMessage(senderId, receiverId, content) {
    return await apiRequest("/messages", {
      method: "POST",
      body: JSON.stringify({ receiverId, content }),
    });
  },

  /** Fetch conversations and unread counts from SQL Server. */
  async getConversations(userId) {
    return await apiRequest("/messages/conversations");
  },

  /** Mark all messages from a contact as read. */
  async markAsRead(userId, contactId) {
    return await apiRequest(`/messages/read/${encodeURIComponent(contactId)}`, { method: "PATCH" });
  },

  /* ================= EMPLOYER INVITES ================= */

  /**
   * Gửi lời mời kết nối từ nhà tuyển dụng đến ứng viên
   */
  async sendInvite(employerId, candidateId, jobId, message) {
    return await apiRequest("/invites", {
      method: "POST",
      body: JSON.stringify({ candidateId, jobId: jobId || null, message: message || "" }),
    });
  },

  /**
   * Lấy danh sách lời mời của ứng viên
   */
  async getInvitesByCandidate(candidateId) {
    if (!candidateId) return [];
    return await apiRequest("/invites");
  },

  /**
   * Cập nhật trạng thái lời mời (accepted/rejected)
   */
  async updateInviteStatus(inviteId, status) {
    return await apiRequest(`/invites/${encodeURIComponent(inviteId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  /* ================= PROFILE VIEWS ================= */

  /**
   * Ghi nhận lượt xem hồ sơ ứng viên
   */
  async recordProfileView(employerId, candidateId) {
    if (!candidateId) return;
    return await apiRequest("/profile-views", {
      method: "POST",
      body: JSON.stringify({ candidateId }),
    });
  },

  /**
   * Lấy danh sách nhà tuyển dụng đã xem hồ sơ ứng viên
   */
  async getProfileViewsByCandidate(candidateId) {
    if (!candidateId) return [];
    return await apiRequest("/profile-views");
  },

  /* ================= MIGRATION TOOL ================= */

  /**
   * Migrate legacy data from LocalStorage to Firestore
   */
  async migrateFromLocalStorage() {
    const collections = ["jobs", "users", "applications", "companies", "messages", "savedJobs"];
    let migratedCount = 0;

    for (const key of collections) {
      const data = localStorage.getItem(key);
      if (!data) continue;

      try {
        const items = JSON.parse(data);
        if (Array.isArray(items)) {
          for (const item of items) {
            const id = item.id;
            const dataToSave = { ...item };
            delete dataToSave.id;

            // Normalization
            if (key === "jobs") dataToSave.recruiterId = dataToSave.recruiterId || dataToSave.createdBy;
            if (key === "applications") {
              dataToSave.applicantId = dataToSave.applicantId || dataToSave.candidateId;
              if (!dataToSave.recruiterId && dataToSave.jobId) {
                const jobsData = localStorage.getItem("jobs");
                if (jobsData) {
                  const jobs = JSON.parse(jobsData);
                  const job = jobs.find(j => j.id === dataToSave.jobId);
                  if (job) dataToSave.recruiterId = job.recruiterId || job.createdBy;
                }
              }
            }

            if (id) {
              await setDoc(doc(db, key, id), dataToSave);
            } else {
              await addDoc(collection(db, key), dataToSave);
            }
          }
        }
        localStorage.removeItem(key);
        migratedCount++;
        console.info(`Migrated ${key} successfully.`);
      } catch (e) {
        console.error(`Failed to migrate ${key}:`, e);
      }
    }

    if (migratedCount > 0) {
      console.log("Migration complete. Refreshing...");
      location.reload();
    }
  }
};

// Kiểm tra migration khi load — chỉ chạy nếu có data cũ VÀ chưa migration
const hasOldData = ['jobs','users','applications'].some(k => localStorage.getItem(k));
if (hasOldData && !localStorage.getItem("migration_done")) {
  window.DB.migrateFromLocalStorage().then(() => {
    localStorage.setItem("migration_done", "true");
  });
}
