function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} trong file .env`);
  }
  return value;
}

function buildConfig() {
  return {
    server: requireEnv('DB_SERVER'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {}),
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    ...(!process.env.DB_INSTANCE ? { port: Number(process.env.DB_PORT) || 1433 } : {}),
  };
}

module.exports = { buildConfig };
