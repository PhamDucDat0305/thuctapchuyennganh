const crypto = require("crypto");

function getOTPSecret() {
  const secret = process.env.OTP_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("OTP_SECRET thiếu hoặc phải có ít nhất 32 byte ngẫu nhiên");
  }
  return secret;
}

function validateOTPSecret() {
  getOTPSecret();
}

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOTP(email, otp) {
  return crypto
    .createHmac("sha256", getOTPSecret())
    .update(`${email}:${otp}`)
    .digest("hex");
}

function verifyOTP(email, otp, storedHash) {
  const inputHash = hashOTP(email, otp);

  const inputBuffer = Buffer.from(inputHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  return (
    inputBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(inputBuffer, storedBuffer)
  );
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  validateOTPSecret,
};
