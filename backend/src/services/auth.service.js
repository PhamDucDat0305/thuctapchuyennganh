const argon2 = require("argon2");
const repository = require("../repositories/auth.repository");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_ROLES = ["candidate", "employer"];
let dummyHashPromise;
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}
function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}
async function getDummyHash() {
  if (!dummyHashPromise)
    dummyHashPromise = argon2.hash("dummy-password-for-timing", {
      type: argon2.argon2id,
    });
  return dummyHashPromise;
}
async function register(body = {}) {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const verificationToken = str(body.verificationToken);
  const fullName = str(body.fullName);
  const role = str(body.role);
  const phone = str(body.phone);
  const companyName = str(body.companyName);
  if (!EMAIL_RE.test(email) || email.length > 255) fail("Email không hợp lệ");
  if (!verificationToken || verificationToken.length > 200)
    fail("Hãy xác minh email trước khi đăng ký");
  if (password.length < 8 || password.length > 128)
    fail("Mật khẩu phải từ 8 đến 128 ký tự");
  if (!fullName || fullName.length > 150)
    fail("Họ tên là bắt buộc (tối đa 150 ký tự)");
  if (!PUBLIC_ROLES.includes(role))
    fail("Vai trò phải là candidate hoặc employer");
  if (phone.length > 10) fail("Số điện thoại quá dài (tối đa 10 ký tự)");
  if (role === "employer" && (!companyName || companyName.length > 200))
    fail("Nhà tuyển dụng cần nhập tên công ty (tối đa 200 ký tự)");
  if (await repository.emailExists(email)) fail("Email đã được đăng ký", 409);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const id = await repository.register({
    email,
    passwordHash,
    fullName,
    phone,
    role,
    companyName,
    verificationToken,
  });
  return { id, email, fullName, role };
}
async function login(body = {}) {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || password.length > 128)
    fail("Vui lòng nhập email và mật khẩu");
  const user = await repository.findLoginUser(email);
  const hash = user?.password_hash || (await getDummyHash());
  let passwordOk = false;
  try {
    passwordOk = await argon2.verify(hash, password);
  } catch (_) {
    passwordOk = false;
  }
  if (!user || !user.password_hash || !passwordOk)
    fail("Email hoặc mật khẩu không đúng", 401);
  if (user.status !== "active" || user.admin_locked)
    fail("Tài khoản đã bị khóa", 403);
  return publicUser(user);
}
module.exports = { register, login };
