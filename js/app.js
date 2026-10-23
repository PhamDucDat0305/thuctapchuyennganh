/* ========== SHARED UTILITIES & NAVIGATION ========== */

function escapeChatHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

/**
 * BadgeNotifier Module
 * Handles notification badges for different user roles
 */
const BadgeNotifier = {
  _seenKey(userId, pageKey) {
    return `notif_seen_${userId}_${pageKey}`;
  },

  getLastSeen(userId, pageKey) {
    const value = localStorage.getItem(this._seenKey(userId, pageKey));
    return value ? new Date(value) : new Date(0);
  },

  markSeen(userId, pageKey) {
    localStorage.setItem(this._seenKey(userId, pageKey), new Date().toISOString());
    this._setBadgeCount(pageKey, 0);
  },

  /**
   * Specifically for candidate invites
   */
  markSeenInvites(userId) {
    this.markSeen(userId, "invites");
  },

  /**
   * Specifically for candidate profile views
   */
  markSeenProfileViews(userId) {
    this.markSeen(userId, "profile_views");
  },

  _setBadgeCount(pageKey, count) {
    const element = document.querySelector(`[data-badge-key="${pageKey}"]`);
    if (!element) return;
    
    if (count > 0) {
      element.textContent = "+" + (count > 99 ? "99+" : count);
      element.style.display = "inline-flex";
      element.classList.add("nav-badge-pop");
      setTimeout(() => element.classList.remove("nav-badge-pop"), 400);
    } else {
      element.style.display = "none";
    }
  },

  /**
   * Individual counter logic for each notification type
   */
  _counts: {
    async emp_applied(userId) {
      try {
        const jobs = await window.DB.getJobsByEmployer(userId);
        const jobIds = new Set(jobs.map(j => j.id));
        const lastSeen = BadgeNotifier.getLastSeen(userId, "emp_applied");
        const apps = await window.DB.getApplications();
        return apps.filter(a => 
          jobIds.has(a.jobId) && 
          a.status === "applied" && 
          new Date(a.appliedAt) > lastSeen
        ).length;
      } catch (e) { return 0; }
    },
    async emp_interviews(userId) {
      try {
        const jobs = await window.DB.getJobsByEmployer(userId);
        const jobIds = new Set(jobs.map(j => j.id));
        const lastSeen = BadgeNotifier.getLastSeen(userId, "emp_interviews");
        const apps = await window.DB.getApplications();
        return apps.filter(a => 
          jobIds.has(a.jobId) && 
          a.status === "interview_scheduled" && 
          new Date(a.updatedAt || a.appliedAt) > lastSeen
        ).length;
      } catch (e) { return 0; }
    },
    async cand_apps(userId) {
      try {
        const lastSeen = BadgeNotifier.getLastSeen(userId, "cand_apps");
        const apps = await window.DB.getApplicationsByCandidate(userId);
        const statusChange = ["interview_scheduled", "accepted", "rejected", "failed"];
        return apps.filter(a => 
          statusChange.includes(a.status) && 
          new Date(a.updatedAt || a.appliedAt) > lastSeen
        ).length;
      } catch (e) { return 0; }
    },
    async cand_interviews(userId) {
      try {
        const lastSeen = BadgeNotifier.getLastSeen(userId, "cand_interviews");
        const apps = await window.DB.getApplicationsByCandidate(userId);
        const appIds = new Set(apps.map(a => a.id));
        const interviews = await window.DB.getInterviews();
        return interviews.filter(i => 
          appIds.has(i.applicationId) && 
          new Date(i.createdAt) > lastSeen
        ).length;
      } catch (e) { return 0; }
    },
    async invites(userId) {
      try {
        // Lấy số lời mời đang chờ từ SQL Server qua API.
        const invites = await window.DB.getInvitesByCandidate(userId);
        return invites.filter(i => i.status === 'pending').length;
      } catch (e) { return 0; }
    },
    async profile_views(userId) {
      try {
        // Lấy lịch sử lượt xem hồ sơ từ SQL Server qua API.
        const lastSeen = BadgeNotifier.getLastSeen(userId, "profile_views");
        const views = await window.DB.getProfileViewsByCandidate(userId);
        return views.filter(v => new Date(v.viewedAt) > lastSeen).length;
      } catch (e) { return 0; }
    }
  },

  async getCount(pageKey, userId) {
    if (this._counts[pageKey]) {
      return await this._counts[pageKey](userId);
    }
    return 0;
  },

  async getAllCounts(userId, role) {
    const counts = {};
    if (role === "employer") {
      counts.emp_applied = await this.getCount("emp_applied", userId);
      counts.emp_interviews = await this.getCount("emp_interviews", userId);
    } else if (role === "candidate") {
      counts.cand_apps = await this.getCount("cand_apps", userId);
      counts.cand_interviews = await this.getCount("cand_interviews", userId);
      counts.invites = await this.getCount("invites", userId);
      counts.profile_views = await this.getCount("profile_views", userId);
    }
    return counts;
  },

  startPolling(userId, role, intervalMs = 5000) {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      const counts = await this.getAllCounts(userId, role);
      Object.entries(counts).forEach(([key, count]) => {
        this._setBadgeCount(key, count);
      });
    }, intervalMs);
  }
};

window.BadgeNotifier = BadgeNotifier;

/**
 * Main App Module
 */
window.App = {
  /* ================= SIDEBAR RENDERING ================= */
  
  /**
   * Render the dashboard sidebar based on user role
   */
  async renderSidebar(role, activePage) {
    const user = Auth.getCurrentUser();
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !user) return;

    const initials = user.fullName
      ? user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
      : "U";
    
    const roleLabels = {
      admin: "Quản trị viên",
      employer: "Nhà tuyển dụng",
      candidate: "Ứng viên"
    };

    const badgeCounts = await BadgeNotifier.getAllCounts(user.id, role);
    const renderBadge = (key) => {
      const count = badgeCounts[key] || 0;
      const hidden = count > 0 ? "" : ' style="display:none"';
      return `<span class="nav-badge" data-badge-key="${key}"${hidden}>+${count > 99 ? "99+" : count}</span>`;
    };

    let menuHTML = "";
    if (role === "admin") menuHTML = this._getAdminMenu(activePage);
    else if (role === "employer") menuHTML = this._getEmployerMenu(activePage, renderBadge);
    else if (role === "candidate") menuHTML = this._getCandidateMenu(activePage, renderBadge);

    sidebar.innerHTML = `
      <div class="sidebar-header-mobile">
        <div style="flex: 1"></div>
        <button class="btn-close-sidebar" onclick="App.toggleSidebar()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="sidebar-menu">${menuHTML}</div>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user.fullName}</div>
            <div class="user-role">${roleLabels[user.role]}</div>
          </div>
          <button onclick="Auth.logout()" title="Đăng xuất" class="btn-logout-sidebar"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </div>
    `;

    if (role !== "admin") BadgeNotifier.startPolling(user.id, role);
    this._ensureSidebarOverlay();
    this.ensureSidebarToggle();
  },

  _getAdminMenu(active) {
    const link = (href, page, icon, text, color) => 
      `<a href="${href}" class="${active === page ? 'active' : ''}"><span class="icon"><i class="fa-solid ${icon} ${color}"></i></span> ${text}</a>`;
    
    return `
      <div class="menu-label">Tổng quan</div>
      ${link("dashboard.html", "dashboard", "fa-chart-simple", "Dashboard", "text-primary")}
      <div class="menu-label">Quản lý</div>
      ${link("manage-users.html", "users", "fa-users", "Quản lý User", "text-info")}
      ${link("manage-jobs.html", "jobs", "fa-file-lines", "Quản lý Job", "text-success")}
      ${link("reports.html", "reports", "fa-chart-line", "Báo cáo", "text-warning")}
      <div class="menu-label">Hệ thống</div>
      <a href="../index.html"><span class="icon"><i class="fa-solid fa-globe text-indigo"></i></span> Xem trang web</a>
    `;
  },

  _getEmployerMenu(active, badge) {
    const link = (href, page, icon, text, color, badgeKey = null) => 
      `<a href="${href}" class="${active === page ? 'active' : ''}"><span class="icon"><i class="fa-solid ${icon} ${color}"></i></span> ${text}${badgeKey ? badge(badgeKey) : ''}</a>`;

    return `
      <div class="menu-label">Tổng quan</div>
      ${link("dashboard.html", "dashboard", "fa-chart-simple", "Dashboard", "text-primary")}
      <div class="menu-label">Quản lý tuyển dụng</div>
      ${link("post-job.html", "post", "fa-pen-to-square", "Đăng tin tuyển dụng", "text-success")}
      ${link("my-jobs.html", "myjobs", "fa-rectangle-list", "Danh sách tin tuyển dụng", "text-info")}
      <div class="menu-label">Quản lý ứng viên</div>
      ${link("applicants.html", "applicants", "fa-users", "Danh sách ứng viên", "text-purple")}
      ${link("applied-candidates.html", "applied", "fa-inbox", "Ứng viên đã ứng tuyển", "text-orange", "emp_applied")}
      ${link("interviews.html", "interviews", "fa-calendar-days", "Lịch phỏng vấn", "text-indigo", "emp_interviews")}
      ${link("accepted-candidates.html", "accepted", "fa-circle-check", "Ứng viên đã trúng tuyển", "text-success")}
      ${link("saved-candidates.html", "saved_candidates", "fa-thumbtack", "Ứng viên đã lưu", "text-pink")}
      <div class="menu-label">Quản lý công ty</div>
      ${link("company-profile.html", "company", "fa-building", "Hồ sơ công ty", "text-teal")}
      ${link("edit-company.html", "edit_company", "fa-pen-to-square", "Chỉnh sửa thông tin", "text-primary")}
      <div class="menu-label">Báo cáo & thống kê</div>
      ${link("stats-views.html", "stats_views", "fa-eye", "Lượt xem tin", "text-warning")}
      ${link("stats-performance.html", "stats_performance", "fa-chart-simple", "Hiệu quả tuyển dụng", "text-success")}
      ${link("messages.html", "messages", "fa-comments", "Tin nhắn", "text-primary")}
      <div class="menu-label">Cá nhân & Bảo mật</div>
      ${link("account.html", "account", "fa-user", "Thông tin tài khoản", "text-primary")}
      ${link("password.html", "password", "fa-key", "Đổi mật khẩu", "text-warning")}
      ${link("security.html", "security", "fa-shield-halved", "Cài đặt bảo mật", "text-danger")}
    `;
  },

  _getCandidateMenu(active, badge) {
    const link = (href, page, icon, text, color, badgeKey = null) => 
      `<a href="${href}" class="${active === page ? 'active' : ''}"><span class="icon"><i class="fa-solid ${icon} ${color}"></i></span> ${text}${badgeKey ? badge(badgeKey) : ''}</a>`;

    return `
      <div class="menu-label">Tổng quan</div>
      ${link("dashboard.html", "dashboard", "fa-chart-simple", "Dashboard", "text-primary")}
      <div class="menu-label">Quản lý tìm việc</div>
      ${link("saved-jobs.html", "saved_jobs", "fa-bookmark", "Việc làm đã lưu", "text-pink")}
      ${link("my-applications.html", "my_apps", "fa-envelope-open-text", "Việc làm đã ứng tuyển", "text-orange", "cand_apps")}
      ${link("interviews.html", "interviews", "fa-calendar-days", "Lịch phỏng vấn", "text-primary", "cand_interviews")}
      ${link("accepted-jobs.html", "accepted", "fa-circle-check", "Việc làm trúng tuyển", "text-success")}
      <div class="menu-label">Quản lý CV & Cover Letter</div>
      ${link("my-cv.html", "my_cv", "fa-file-lines", "CV của tôi", "text-success")}
      ${link("cover-letter.html", "cover_letter", "fa-envelope", "Cover Letter của tôi", "text-info")}
      <div class="menu-label">Tương tác nhà tuyển dụng</div>
      ${link("employer-invites.html", "invites", "fa-handshake", "Lời mời kết nối", "text-indigo", "invites")}
      ${link("profile-views.html", "profile_views", "fa-eye", "Nhà tuyển dụng xem hồ sơ", "text-warning", "profile_views")}
      ${link("messages.html", "messages", "fa-comments", "Tin nhắn", "text-primary")}
      <div class="menu-label">Cá nhân & Bảo mật</div>
      ${link("account.html", "account", "fa-user", "Thông tin cá nhân", "text-primary")}
      ${link("security.html", "security", "fa-shield-halved", "Cài đặt bảo mật", "text-danger")}
    `;
  },

  _ensureSidebarOverlay() {
    if (!document.getElementById("sidebarOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "sidebarOverlay";
      overlay.className = "sidebar-overlay";
      overlay.onclick = () => this.toggleSidebar();
      document.body.appendChild(overlay);
    }
  },

  ensureSidebarToggle() {
    const contentArea = document.querySelector(".content-area");
    if (!contentArea) return;

    let topBar = document.getElementById("dashboardTopBar");
    if (!topBar) {
      topBar = document.createElement("div");
      topBar.id = "dashboardTopBar";
      topBar.className = "dashboard-top-bar";
      contentArea.prepend(topBar);
    }

    if (!document.getElementById("sidebarToggle")) {
      const toggleBtn = document.createElement("button");
      toggleBtn.id = "sidebarToggle";
      toggleBtn.className = "btn btn-icon btn-secondary sidebar-toggle-btn";
      toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
      toggleBtn.onclick = () => this.toggleSidebar();
      topBar.prepend(toggleBtn);
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("active");
      document.body.style.overflow = sidebar.classList.contains("open") ? "hidden" : "";
    }
  },

  /* ================= JOB RENDERING ================= */

  /**
   * Render featured jobs on homepage
   */
  async renderFeaturedJobs() {
    const container = document.getElementById("featuredJobs");
    if (!container || typeof window.DB === "undefined") return;

    container.innerHTML = '<div class="loading-state">Đang tải việc làm...</div>';
    
    try {
      const allJobs = await window.DB.getJobs();
      let jobs = allJobs.filter(job => job.status === "active");

      const user = Auth.getCurrentUser();
      if (user && user.role === "candidate") {
        const remainingJobs = [];
        for (const job of jobs) {
          const applied = await window.DB.hasApplied(job.id, user.id);
          if (!applied) remainingJobs.push(job);
        }
        jobs = remainingJobs;
      }

      jobs = jobs.reverse().slice(0, 8); // Last 8 jobs
      
      if (jobs.length === 0) {
        container.innerHTML = '<div class="empty-state">Hiện chưa có việc làm nào phù hợp.</div>';
        return;
      }

      container.innerHTML = jobs.map(job => this._jobCardTemplate(job)).join("");
    } catch (error) {
      console.error("App: renderFeaturedJobs error", error);
      container.innerHTML = '<div class="error-state">Lỗi tải dữ liệu việc làm.</div>';
    }
  },

  _jobCardTemplate(job) {
    return `
      <div class="job-card animate-fade-up">
        <div class="job-card-header">
          <div class="job-title">${job.title}</div>
          <div class="job-company">${job.companyName}</div>
        </div>
        <div class="job-meta">
          <span><i class="fa-solid fa-location-dot text-danger"></i> ${job.location}</span>
          <span><i class="fa-solid fa-money-bill-wave text-success"></i> ${job.salary}</span>
        </div>
        <div class="job-actions">
          <button onclick="App.viewJob('${job.id}')" class="btn btn-sm btn-primary">Xem chi tiết</button>
        </div>
      </div>
    `;
  },

  viewJob(jobId) {
    const isDashboard = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    window.location.href = (isDashboard ? "../" : "") + "job-detail.html?id=" + jobId;
  },

  /* ================= NAVIGATION & FOOTER ================= */

  renderFooter() {
    const footer = document.getElementById("footer");
    if (!footer) return;

    const isDashboard = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    const base = isDashboard ? "../" : "";

    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <h4><i class="fa-solid fa-briefcase"></i> Job Việt</h4>
            <p>Nền tảng tuyển dụng hàng đầu Việt Nam. Kết nối nhân tài với cơ hội nghề nghiệp tốt nhất.</p>
          </div>
          <div>
            <h4>Ứng viên</h4>
            <ul>
              <li><a href="${base}job-list.html">Tìm việc làm</a></li>
              <li><a href="#" onclick="App.protectedNav(event, '${base}candidate/my-applications.html', 'candidate')">Việc đã ứng tuyển</a></li>
              <li><a href="#" onclick="App.protectedNav(event, '${base}candidate/saved-jobs.html', 'candidate')">Việc đã lưu</a></li>
            </ul>
          </div>
          <div>
            <h4>Nhà tuyển dụng</h4>
            <ul>
              <li><a href="#" onclick="App.protectedNav(event, '${base}employer/post-job.html', 'employer')">Đăng tuyển dụng</a></li>
              <li><a href="#" onclick="App.protectedNav(event, '${base}employer/my-jobs.html', 'employer')">Quản lý tin</a></li>
              <li><a href="#" onclick="App.protectedNav(event, '${base}employer/company-profile.html', 'employer')">Hồ sơ công ty</a></li>
            </ul>
          </div>
          <div>
            <h4>Liên kết</h4>
            <ul>
              <li><a href="${base}about.html">Giới thiệu</a></li>
              <li><a href="${base}contact.html">Liên hệ</a></li>
              <li><a href="${base}LabThucHanh.html">Lab Thực Hành</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          © 2026 Job Việt — Hệ thống tuyển dụng và tìm việc làm hiện đại
        </div>
      </div>
    `;
  },

  protectedNav(event, url, role) {
    if (event) event.preventDefault();
    const user = Auth.getCurrentUser();
    const isDashboard = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    const authPath = isDashboard ? "../auth.html" : "auth.html";

    if (!user) {
      window.location.href = authPath;
      return;
    }

    if (role && user.role !== role) {
      alert(`Trang này dành cho ${role === "candidate" ? "Ứng viên" : "Nhà tuyển dụng"}!`);
      return;
    }

    window.location.href = url;
  },

  /* ================= UTILITIES ================= */

  paginate(items, page = 1, perPage = 8) {
    const totalPages = Math.ceil(items.length / perPage);
    const start = (page - 1) * perPage;
    return {
      data: items.slice(start, start + perPage),
      currentPage: page,
      totalPages: totalPages,
      totalItems: items.length,
    };
  },

  renderPagination(container, totalPages, currentPage, onPageChange) {
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = "";
      return;
    }
    
    let html = `<button ${currentPage === 1 ? "disabled" : ""} onclick="(${onPageChange})(${currentPage - 1})">‹</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
        if (i === 4 || i === totalPages - 3) html += `<button disabled>…</button>`;
        continue;
      }
      html += `<button class="${i === currentPage ? "active" : ""}" onclick="(${onPageChange})(${i})">${i}</button>`;
    }
    
    html += `<button ${currentPage === totalPages ? "disabled" : ""} onclick="(${onPageChange})(${currentPage + 1})">›</button>`;
    container.innerHTML = html;
  },

  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  },

  /* ================= FLOATING CHAT WIDGET ================= */

  initFloatingChat() {
    const user = Auth.getCurrentUser();
    if (!user || user.role === "admin" || window.location.pathname.includes("messages.html")) return;

    // Create Widget Container
    const widget = document.createElement("div");
    widget.id = "chatWidget";
    widget.className = "chat-widget";
    document.body.appendChild(widget);

    // Create Floating Button
    const btn = document.createElement("div");
    btn.className = "floating-chat-btn";
    btn.innerHTML = '<i class="fa-solid fa-comment-dots"></i>';
    btn.onclick = () => {
      widget.classList.toggle("active");
      if (widget.classList.contains("active")) this._renderChatList(user, widget);
    };
    document.body.appendChild(btn);

    this._setupChatPolling(user, widget, btn);
  },

  async _renderChatList(user, widget) {
    let conversations;
    try {
      conversations = await window.DB.getConversations(user.id);
    } catch (error) {
      console.error("Chat: could not load conversations", error);
      widget.innerHTML = `
        <div class="widget-header">
          <div class="widget-header-title"><i class="fa-solid fa-comment-dots"></i> Tin nhắn</div>
          <button class="widget-icon-btn" onclick="document.getElementById('chatWidget').classList.remove('active')" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="w-empty" role="alert">
          <div>Không tải được hội thoại.</div>
          <div style="margin-top:8px;font-size:12px">${escapeChatHtml(error.message || "Kiểm tra kết nối backend và bảng dbo.messages.")}</div>
          <button class="widget-icon-btn" style="margin:12px auto 0" onclick="App._renderChatList(Auth.getCurrentUser(), document.getElementById('chatWidget'))">Thử lại</button>
        </div>`;
      return;
    }
    this._chatContacts = new Map(
      conversations.filter((item) => item.contact).map((item) => [String(item.contact.id), item.contact]),
    );
    const isDashboard = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    const msgUrl = (isDashboard ? "" : (user.role === "employer" ? "employer/" : "candidate/")) + "messages.html";

    widget.innerHTML = `
      <div class="widget-header">
        <div class="widget-header-title"><i class="fa-solid fa-comment-dots"></i> Tin nhắn</div>
        <button class="widget-close" onclick="document.getElementById('chatWidget').classList.remove('active')"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="widget-body" id="widgetBody">
        ${conversations.length ? conversations.map(c => this._convItemTemplate(c)).join("") : '<div class="w-empty">Chưa có tin nhắn nào.</div>'}
      </div>
      <div class="widget-footer">
        <a href="${msgUrl}">Xem tất cả <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    `;
  },

  _convItemTemplate(c) {
    const initials = c.contact.fullName ? c.contact.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "U";
    return `
      <div class="w-conv-item" onclick="App.openChat('${c.contact.id}')">
        <div class="w-avatar">${initials}</div>
        <div class="w-info">
          <div class="w-name">${escapeChatHtml(c.contact.fullName || 'User')}</div>
          <div class="w-preview ${c.unreadCount > 0 ? 'unread' : ''}">${c.lastMessage ? escapeChatHtml(c.lastMessage.content) : '...'}</div>
        </div>
        ${c.unreadCount > 0 ? `<div class="w-badge">${c.unreadCount}</div>` : ''}
      </div>
    `;
  },

  async openChat(contactId) {
    const user = Auth.getCurrentUser();
    const widget = document.getElementById("chatWidget");
    if (!widget || !user) return;
    
    this._activeChatContact = contactId;
    widget.classList.add("active");
    
    let contact;
    let messages;
    try {
      contact = this._chatContacts?.get(String(contactId)) || await window.DB.getUserById(contactId);
      messages = await window.DB.getMessages(user.id, contactId);
      if (!contact) throw new Error("Không tìm thấy tài khoản đang trò chuyện.");
    } catch (error) {
      console.error("Chat: could not open conversation", error);
      widget.innerHTML = `
        <div class="widget-header">
          <div class="widget-header-title">Tin nhắn</div>
          <button class="widget-icon-btn" onclick="document.getElementById('chatWidget').classList.remove('active')" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="w-empty" role="alert">
          <div>Không mở được cuộc trò chuyện.</div>
          <div style="margin-top:8px;font-size:12px">${escapeChatHtml(error.message || "Kiểm tra kết nối backend.")}</div>
          <button class="widget-icon-btn" style="margin:12px auto 0" onclick="App._renderChatList(Auth.getCurrentUser(), document.getElementById('chatWidget'))">Quay lại</button>
        </div>`;
      return;
    }
    this._activeChatCursor = messages.nextCursor;
    this._activeChatHasMore = messages.hasMore;
    
    widget.innerHTML = `
      <div class="w-chat-header">
        <button onclick="App._renderChatList(Auth.getCurrentUser(), document.getElementById('chatWidget'))"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="w-chat-name">${escapeChatHtml(contact.fullName || 'User')}</div>
        <button onclick="document.getElementById('chatWidget').classList.remove('active')"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="w-msg-list" id="widgetMsgList">
        ${messages.hasMore ? `<button type="button" id="widgetLoadOlder" onclick="App.loadOlderChatMessages('${contactId}')">Tải tin cũ hơn</button>` : ""}
        ${messages.messages.map(m => `<div class="w-msg ${m.senderId === user.id ? 'sent' : 'received'}" data-message-id="${m.id}">${escapeChatHtml(m.content)}</div>`).join("")}
      </div>
      <form class="w-input-area" onsubmit="App.handleWidgetSend(event, '${contactId}')">
        <input type="text" id="widgetInput" maxlength="2000" placeholder="Aa..." autocomplete="off">
        <button type="submit"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    `;

    const list = document.getElementById("widgetMsgList");
    if (list) list.scrollTop = list.scrollHeight;
    try {
      await window.DB.markAsRead(user.id, contactId);
    } catch (error) {
      console.error("Chat: could not mark conversation as read", error);
    }
  },

  async loadOlderChatMessages(contactId) {
    if (this._loadingOlderChat || !this._activeChatHasMore || !this._activeChatCursor || String(contactId) !== String(this._activeChatContact)) return;
    const list = document.getElementById("widgetMsgList");
    const button = document.getElementById("widgetLoadOlder");
    const user = Auth.getCurrentUser();
    if (!list || !button || !user) return;
    this._loadingOlderChat = true;
    button.disabled = true;
    const oldHeight = list.scrollHeight;
    const oldTop = list.scrollTop;
    try {
      const page = await window.DB.getMessages(user.id, contactId, this._activeChatCursor);
      this._activeChatCursor = page.nextCursor;
      this._activeChatHasMore = page.hasMore;
      const markup = page.messages.map((m) => `<div class="w-msg ${m.senderId === user.id ? 'sent' : 'received'}" data-message-id="${m.id}">${escapeChatHtml(m.content)}</div>`).join("");
      button.insertAdjacentHTML("afterend", markup);
      button.hidden = !page.hasMore;
      list.scrollTop = oldTop + (list.scrollHeight - oldHeight);
    } finally {
      this._loadingOlderChat = false;
      if (button.isConnected) button.disabled = false;
    }
  },

  async handleWidgetSend(event, toId) {
    event.preventDefault();
    const user = Auth.getCurrentUser();
    const input = document.getElementById("widgetInput");
    if (!input || !input.value.trim()) return;

    await window.DB.sendMessage(user.id, toId, input.value.trim());
    input.value = "";
    this.openChat(toId);
  },

  _setupChatPolling(user, widget, btn) {
    setInterval(async () => {
      const conversations = await window.DB.getConversations(user.id);
      const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      
      let badge = btn.querySelector(".unread-badge");
      if (unreadTotal > 0) {
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "unread-badge";
          btn.appendChild(badge);
        }
        badge.textContent = unreadTotal > 9 ? "9+" : unreadTotal;
      } else if (badge) badge.remove();

      if (widget.classList.contains("active")) {
        if (this._activeChatContact) {
          const msgs = await window.DB.getMessages(user.id, this._activeChatContact);
          const list = document.getElementById("widgetMsgList");
          const lastRenderedId = list?.querySelector(".w-msg:last-child")?.dataset.messageId;
          const latestId = msgs.messages.at(-1)?.id;
          if (list && latestId && String(latestId) !== lastRenderedId) this.openChat(this._activeChatContact);
        } else {
          this._renderChatList(user, widget);
        }
      }
    }, 5000);
  }
};

// Auto-init on DOM load
document.addEventListener("DOMContentLoaded", () => {
  App.renderFooter();
  App.initFloatingChat();
});
