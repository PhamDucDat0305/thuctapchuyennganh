/**
 * navbar.js — JobViệt
 * Dynamic navbar with role-based dropdown menus
 */

(function () {
  "use strict";

  /* ================= HELPERS ================= */

  /**
   * Get current user from storage
   */
  function getUser() {
    try {
      const local = localStorage.getItem("currentUser");
      const session = sessionStorage.getItem("loggedInUser");
      return JSON.parse(local || session) || null;
    } catch {
      return null;
    }
  }

  /**
   * Generate initials from full name
   */
  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Resolve relative URL based on folder depth
   */
  function resolveHref(path) {
    const isDashboard = location.pathname.includes("/employer/") || location.pathname.includes("/candidate/");
    return isDashboard ? "../" + path : path;
  }

  /* ================= MENU DATA ================= */

  const MENUS = {
    /* --- Candidate Menu --- */
    candidate: [
      {
        label: "Tổng quan",
        items: [
          { icon: "fa-chart-pie", text: "Dashboard", href: resolveHref("candidate/dashboard.html") },
        ],
      },
      {
        label: "Quản lý tìm việc",
        items: [
          { icon: "fa-bookmark", text: "Việc làm đã lưu", href: resolveHref("candidate/saved-jobs.html") },
          { icon: "fa-paper-plane", text: "Việc làm đã ứng tuyển", href: resolveHref("candidate/my-applications.html"), badgeKey: "cand_apps" },
          { icon: "fa-calendar-check", text: "Lịch phỏng vấn", href: resolveHref("candidate/interviews.html"), badgeKey: "cand_interviews" },
          { icon: "fa-circle-check", text: "Việc làm trúng tuyển", href: resolveHref("candidate/accepted-jobs.html") },
        ],
      },
      {
        label: "Quản lý CV & Cover letter",
        items: [
          { icon: "fa-file-lines", text: "CV của tôi", href: resolveHref("candidate/my-cv.html") },
          { icon: "fa-envelope-open-text", text: "Cover Letter của tôi", href: resolveHref("candidate/cover-letter.html") },
        ],
      },
      {
        label: "Tương tác",
        items: [
          { icon: "fa-handshake", text: "Lời mời kết nối", href: resolveHref("candidate/employer-invites.html"), badgeKey: "invites" },
          { icon: "fa-eye", text: "Lượt xem hồ sơ", href: resolveHref("candidate/profile-views.html"), badgeKey: "profile_views" },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { icon: "fa-user-pen", text: "Thông tin cá nhân", href: resolveHref("candidate/account.html") },
          { icon: "fa-shield-halved", text: "Cài đặt bảo mật", href: resolveHref("candidate/security.html") },
        ],
      },
    ],

    /* --- Employer Menu --- */
    employer: [
      {
        label: "Tổng quan",
        items: [
          { icon: "fa-chart-pie", text: "Dashboard", href: resolveHref("employer/dashboard.html") },
        ],
      },
      {
        label: "Quản lý tuyển dụng",
        items: [
          { icon: "fa-pen-to-square", text: "Đăng tin tuyển dụng", href: resolveHref("employer/post-job.html") },
          { icon: "fa-rectangle-list", text: "Quản lý tin đăng", href: resolveHref("employer/my-jobs.html") },
        ],
      },
      {
        label: "Quản lý ứng viên",
        items: [
          { icon: "fa-users", text: "Danh sách ứng viên", href: resolveHref("employer/applicants.html") },
          { icon: "fa-user-check", text: "Ứng viên đã ứng tuyển", href: resolveHref("employer/applied-candidates.html"), badgeKey: "emp_applied" },
          { icon: "fa-calendar-check", text: "Lịch phỏng vấn", href: resolveHref("employer/interviews.html"), badgeKey: "emp_interviews" },
          { icon: "fa-circle-check", text: "Ứng viên đã trúng tuyển", href: resolveHref("employer/accepted-candidates.html") },
        ],
      },
      {
        label: "Công ty",
        items: [
          { icon: "fa-building", text: "Hồ sơ công ty", href: resolveHref("employer/company-profile.html") },
          { icon: "fa-building-pen", text: "Chỉnh sửa thông tin", href: resolveHref("employer/edit-company.html") },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { icon: "fa-id-card", text: "Thông tin tài khoản", href: resolveHref("employer/account.html") },
          { icon: "fa-key", text: "Đổi mật khẩu", href: resolveHref("employer/password.html") },
        ],
      },
    ],
  };

  /* ================= HTML BUILDERS ================= */

  /**
   * Build dropdown sections
   */
  function buildDropdownSections(sections) {
    return sections.map(sec => `
      <div class="dd-section">
        <div class="dd-section-label">${sec.label}</div>
        ${sec.items.map(it => `
          <a href="${it.href}" class="dd-item">
            <div class="dd-item-icon"><i class="fa-solid ${it.icon}"></i></div>
            <span class="dd-item-text">${it.text}</span>
            ${it.badgeKey ? `<span class="nav-badge dropdown-badge" data-dropdown-badge-key="${it.badgeKey}" style="display:none"></span>` : ""}
          </a>`).join("")}
      </div>`).join("");
  }

  /**
   * Assemble the full navbar HTML
   */
  function buildNavbarHTML(user) {
    const links = [
      { href: resolveHref("index.html"), label: "Trang chủ" },
      { href: resolveHref("job-list.html"), label: "Việc làm" },
      { href: resolveHref("about.html"), label: "Giới thiệu" },
      { href: resolveHref("contact.html"), label: "Liên hệ" },
    ];
    
    const currentPage = location.pathname.split("/").pop() || "index.html";
    const navLinksHTML = links.map(l => {
      // So sánh tên file cuối cùng của href với tên file hiện tại
      const linkPage = l.href.split("/").pop();
      return `<a href="${l.href}" class="${currentPage === linkPage ? "active" : ""}">${l.label}</a>`;
    }).join("");

    const authAreaHTML = user ? buildProfileHTML(user) : buildLoginButtons();

    return `
      <nav class="navbar" id="navbar">
        <div class="navbar-inner">
          <a href="${resolveHref("index.html")}" class="navbar-logo">
            <i class="fa-solid fa-briefcase"></i> JobViệt
          </a>
          <div class="navbar-links" id="navLinks">${navLinksHTML}</div>
          <button class="navbar-hamburger" id="navHamburger">
            <span></span><span></span><span></span>
          </button>
          ${authAreaHTML}
        </div>
      </nav>`;
  }

  function buildLoginButtons() {
    return `
      <div class="navbar-right" id="navAuthArea">
        <a href="${resolveHref("auth.html")}" class="nav-auth-btn nav-btn-login"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</a>
        <a href="${resolveHref("auth.html?mode=register")}" class="nav-auth-btn nav-btn-register"><span class="reg-text">Đăng ký</span></a>
      </div>`;
  }

  function buildProfileHTML(user) {
    const userInitials = getInitials(user.fullName);
    const avatar = user.avatar ? `<img src="${user.avatar}" alt="avatar">` : userInitials;
    const role = user.role || "candidate";
    const roleLabel = role === "employer" ? "Nhà tuyển dụng" : "Ứng viên";
    const sections = MENUS[role] || MENUS.candidate;

    return `
      <div class="navbar-right" id="navAuthArea">
        <div class="nav-profile-wrapper is-logged-in" id="navProfileWrapper">
          <div class="nav-profile-trigger" id="navProfileTrigger">
            <div class="nav-avatar">${avatar}</div>
            <span class="nav-username">${user.username || ""}</span>
            <span class="nav-badge nav-profile-badge" id="navNotificationBadge" style="display:none"></span>
            <i class="fa-solid fa-chevron-down nav-chevron"></i>
          </div>
          <div class="nav-dropdown" id="navDropdown">
            <div class="dd-header">
              <div class="dd-avatar">${avatar}</div>
              <div class="dd-header-info">
                <div class="dd-name">${user.fullName || user.username || ""}</div>
                <div class="dd-role-badge dd-role-${role}">${roleLabel}</div>
              </div>
            </div>
            ${buildDropdownSections(sections)}
            <div class="dd-footer">
              <button class="dd-logout" id="navLogoutBtn">
                <div class="dd-item-icon"><i class="fa-solid fa-arrow-right-from-bracket"></i></div>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ================= EVENT HANDLING ================= */

  function setupEvents() {
    window.addEventListener("jv:badge-counts", (event) => {
      const counts = event.detail?.counts || {};
      const total = Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const triggerBadge = document.getElementById("navNotificationBadge");
      if (triggerBadge) {
        triggerBadge.textContent = total > 99 ? "99+" : `+${total}`;
        triggerBadge.style.display = total > 0 ? "inline-flex" : "none";
        triggerBadge.setAttribute("aria-label", `${total} thông báo mới`);
      }
      document.querySelectorAll("[data-dropdown-badge-key]").forEach((badge) => {
        const count = Number(counts[badge.dataset.dropdownBadgeKey]) || 0;
        badge.textContent = count > 99 ? "99+" : `+${count}`;
        badge.style.display = count > 0 ? "inline-flex" : "none";
      });
    });

    // Scroll effect
    window.addEventListener("scroll", () => {
      const nav = document.getElementById("navbar");
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 10);
    }, { passive: true });

    // Dropdown logic
    const wrapper = document.getElementById("navProfileWrapper");
    const dropdown = document.getElementById("navDropdown");
    let hideTimer = null;

    if (wrapper && dropdown) {
      wrapper.addEventListener("mouseenter", () => {
        if (window.innerWidth > 768) {
          clearTimeout(hideTimer);
          dropdown.classList.add("is-open");
        }
      });

      wrapper.addEventListener("mouseleave", () => {
        if (window.innerWidth > 768) {
          hideTimer = setTimeout(() => dropdown.classList.remove("is-open"), 150);
        }
      });

      const trigger = document.getElementById("navProfileTrigger");
      if (trigger) {
        trigger.addEventListener("click", (e) => {
          if (window.innerWidth <= 768) {
            e.stopPropagation();
            dropdown.classList.toggle("is-open");
          }
        });
      }

      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) dropdown.classList.remove("is-open");
      });
    }

    // Hamburger
    const hamburger = document.getElementById("navHamburger");
    const navLinks = document.getElementById("navLinks");
    if (hamburger && navLinks) {
      hamburger.addEventListener("click", () => navLinks.classList.toggle("open"));
    }

    // Logout — gọi Auth.logout() để đảm bảo Firebase session được xóa
    const logoutBtn = document.getElementById("navLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (window.Auth && typeof window.Auth.logout === "function") {
          window.Auth.logout();
        } else {
          // Fallback nếu Auth module chưa load
          localStorage.removeItem("currentUser");
          sessionStorage.removeItem("loggedInUser");
          location.href = resolveHref("index.html");
        }
      });
    }
  }

  /* ================= MOUNT ================= */

  function initNavbar() {
    const placeholder = document.getElementById("navbar-placeholder");
    if (!placeholder) return;

    const user = getUser();
    placeholder.outerHTML = buildNavbarHTML(user);
    setupEvents();
    if (user?.role === "employer" && window.DB?.getCompanyByEmployer) {
      window.DB.getCompanyByEmployer(user.id).then((company) => {
        const logo = company?.logoUrl || company?.logo;
        if (!logo) return;
        document.querySelectorAll("#navAuthArea .nav-avatar, #navAuthArea .dd-avatar").forEach((avatar) => {
          const image = document.createElement("img");
          image.src = logo;
          image.alt = "Logo công ty";
          image.onerror = () => image.remove();
          avatar.replaceChildren(image);
        });
      }).catch((error) => console.warn("Navbar: không tải được logo công ty", error));
    }
    if (user && user.role !== "admin" && window.BadgeNotifier) {
      window.BadgeNotifier.startPolling(user.id, user.role, 15000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavbar);
  } else {
    initNavbar();
  }
})();
