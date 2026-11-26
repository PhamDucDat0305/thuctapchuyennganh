const session = require('express-session');
const SequelizeSessionStore = require('./sequelize-session-store');

const SESSION_COOKIE_NAME = 'jv.sid';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let sessionStore = null;

function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET thiếu hoặc quá ngắn trong file .env');
  }

  // Store giữ nguyên bảng dbo.sessions và JSON session hiện có, dùng pool Sequelize.
  sessionStore = new SequelizeSessionStore({ ttl: IDLE_TIMEOUT_MS });
  sessionStore.on('error', (err) => {
    console.error('[session] Lỗi session store:', err.message);
  });

  return session({
    name: SESSION_COOKIE_NAME,
    secret,
    store: sessionStore,
    rolling: true,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // bật khi chạy HTTPS
      sameSite: 'lax',
      maxAge: IDLE_TIMEOUT_MS,
    },
  });
}

async function connectSessionStore() {
  if (!sessionStore) throw new Error('Session store chưa được khởi tạo');
  await sessionStore.pruneExpired();
}

async function closeSessionStore() {
  const store = sessionStore;
  sessionStore = null;
  store?.close();
}

module.exports = { createSessionMiddleware, connectSessionStore, closeSessionStore, SESSION_COOKIE_NAME };
