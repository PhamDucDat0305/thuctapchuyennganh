const session = require('express-session');
const MSSQLStore = require('connect-mssql-v2');
const { buildConfig } = require('./database');

const SESSION_COOKIE_NAME = 'jv.sid';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
let sessionStore = null;

function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET thiếu hoặc quá ngắn trong file .env');
  }

  // Store lưu phiên trong bảng dbo.sessions của SQL Server
  // (phiên vẫn còn sau khi backend khởi động lại).
  sessionStore = new MSSQLStore(buildConfig(), {
    table: '[dbo].[sessions]',
    ttl: SEVEN_DAYS_MS,
    retries: 3,
    retryDelay: 500,
  });
  sessionStore.on('error', (err) => {
    console.error('[session] Lỗi session store:', err.message);
  });

  return session({
    name: SESSION_COOKIE_NAME,
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // bật khi chạy HTTPS
      sameSite: 'lax',
      maxAge: SEVEN_DAYS_MS,
    },
  });
}

async function connectSessionStore() {
  if (!sessionStore) throw new Error('Session store chưa được khởi tạo');
  if (!sessionStore.databaseConnection.connected) {
    await sessionStore.initializeDatabase();
  }
}

async function closeSessionStore() {
  const store = sessionStore;
  sessionStore = null;
  if (store && store.databaseConnection) {
    await store.databaseConnection.close();
  }
}

module.exports = { createSessionMiddleware, connectSessionStore, closeSessionStore, SESSION_COOKIE_NAME };
