const nodemailer = require("nodemailer");

function requireMailConfig() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Thiếu cấu hình SMTP: ${missing.join(", ")}`);
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT phải là số nguyên từ 1 đến 65535");
  }
  if (!/^(true|false)$/i.test(process.env.SMTP_SECURE)) {
    throw new Error("SMTP_SECURE chỉ nhận true hoặc false");
  }

  return {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE.toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
}

function createMailTransporter() {
  return nodemailer.createTransport(requireMailConfig());
}

module.exports = { createMailTransporter };
