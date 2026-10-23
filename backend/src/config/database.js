const sql = require('mssql');

let pool = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} trong file .env`);
  }
  return value;
}

function buildConfig() {
  const config = {
    server: requireEnv('DB_SERVER'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  // Named instance và port không dùng cùng lúc.
  if (process.env.DB_INSTANCE) {
    config.options.instanceName = process.env.DB_INSTANCE;
  } else {
    config.port = Number(process.env.DB_PORT) || 1433;
  }
  return config;
}

// Mở pool MỘT lần khi khởi động.
async function connectDatabase() {
  if (pool) return pool;
  const newPool = new sql.ConnectionPool(buildConfig());
  newPool.on('error', (err) => {
    console.error('[db] Lỗi connection pool:', err.message);
  });
  await newPool.connect();
  pool = newPool;
  return pool;
}

// Các module khác gọi hàm này để lấy pool dùng chung.
function getPool() {
  if (!pool) {
    throw new Error('Database chưa được kết nối');
  }
  return pool;
}

async function checkDatabase() {
  const result = await getPool().request().query('SELECT 1 AS ok');
  return result.recordset[0].ok === 1;
}

async function closeDatabase() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { sql, buildConfig, connectDatabase, getPool, checkDatabase, closeDatabase };
