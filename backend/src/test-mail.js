require("dotenv").config();

const { createMailTransporter } = require("./config/mail");
const { validateOTPSecret } = require("./utils/otp");

async function testMail() {
  let transporter;
  try {
    validateOTPSecret();
    transporter = createMailTransporter();
    await transporter.verify();
    console.log("[mail] SMTP xác thực thành công; chưa gửi email thử.");
  } catch (error) {
    console.error("[mail] Lỗi:", error.message);
    process.exitCode = 1;
  } finally {
    if (transporter) transporter.close();
  }
}

testMail();
