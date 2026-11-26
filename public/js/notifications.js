/* ========== TOAST NOTIFICATIONS ========== */

const Toast = {
  container: null,

  init() {
    if (document.getElementById("toast-container")) {
      this.container = document.getElementById("toast-container");
      return;
    }
    this.container = document.createElement("div");
    this.container.id = "toast-container";
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },

  show(message, type = "info", duration = 3000) {
    this.init();
    const icons = {
      success: '<i class="fa-solid fa-circle-check"></i>',
      error: '<i class="fa-solid fa-circle-xmark"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
      info: '<i class="fa-solid fa-circle-info"></i>',
    };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <span class="toast-msg">${message}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) {
    this.show(msg, "success");
  },
  error(msg) {
    this.show(msg, "error");
  },
  warning(msg) {
    this.show(msg, "warning");
  },
  info(msg) {
    this.show(msg, "info");
  },
};
