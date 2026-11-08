require('dotenv').config();
const argon2 = require('argon2');
const { sql, connectDatabase, closeDatabase, getPool } = require('../src/config/database');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const fullName = String(process.env.ADMIN_FULL_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !fullName || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_FULL_NAME, and ADMIN_PASSWORD (minimum 12 characters) in backend/.env before running.');
  }
  await connectDatabase();
  const pool = getPool();
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const result = await pool.request()
    .input('email', sql.NVarChar(255), email)
    .input('fullName', sql.NVarChar(150), fullName)
    .input('hash', sql.NVarChar(255), hash)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @email)
      BEGIN
        UPDATE dbo.users SET role = N'admin', status = N'active', admin_locked = 0, password_hash = @hash, full_name = @fullName
        WHERE email = @email;
        SELECT N'promoted' AS result;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.users(email, password_hash, full_name, role, status, admin_locked)
        VALUES(@email, @hash, @fullName, N'admin', N'active', 0);
        SELECT N'created' AS result;
      END`);
  console.log(`[admin-seed] Account ${result.recordset[0].result}: ${email}`);
}

main().catch((error) => {
  console.error('[admin-seed] Failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await closeDatabase(); } catch (error) { console.error('[admin-seed] Could not close database:', error.message); }
});
