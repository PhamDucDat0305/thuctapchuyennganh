const { createMailTransporter } = require("../config/mail");

let transporter;

async function sendOTPEmail(to, otp) {
  if (!transporter) transporter = createMailTransporter();
  await transporter.sendMail({
    from: `"JobViệt" <${process.env.SMTP_USER}>`,
    to,
    subject: "Mã xác nhận đăng ký tài khoản JobViệt",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
                <h2 style="color: #2563eb;">JobViệt</h2>

                <h3>Xác nhận địa chỉ email</h3>

                <p>Cảm ơn bạn đã đăng ký tài khoản JobViệt.</p>

                <p>Mã xác nhận của bạn là:</p>

                <div style="
                    background: #f1f5f9;
                    padding: 20px;
                    text-align: center;
                    font-size: 30px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    color: #2563eb;
                ">
                    ${otp}
                </div>

                <p>Mã có hiệu lực trong <b>5 phút</b>.</p>

                <p>Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.</p>

                <hr>

                <small style="color: #64748b;">
                    Email tự động từ hệ thống JobViệt.
                </small>
            </div>
        `,
  });
}

module.exports = { sendOTPEmail };
