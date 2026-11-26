require('dotenv').config();

const http = require('node:http');
const app = require('./app');
const { sequelize } = require('./models');
const { createSocketServer } = require('./sockets');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('[db] Đã kết nối SQL Server qua Sequelize');
  } catch (err) {
    console.error('[db] Không kết nối được SQL Server:', err.message);
    try { await sequelize.close(); } catch (closeError) {
      console.error('[db] Lỗi khi đóng connection pool:', closeError.message);
    }
    process.exitCode = 1;
    return;
  }

  try {
    await app.locals.connectSessionStore();
    console.log('[session] Đã kết nối SQL Server session store');
  } catch (err) {
    console.error('[session] Không kết nối được session store:', err.message);
    try { await app.locals.closeSessionStore(); } catch (closeError) {
      console.error('[session] Lỗi khi đóng session store:', closeError.message);
    }
    try { await sequelize.close(); } catch (closeError) {
      console.error('[db] Lỗi khi đóng connection pool:', closeError.message);
    }
    process.exitCode = 1;
    return;
  }

  const server = http.createServer(app);
  const io = createSocketServer(server, app.locals.sessionMiddleware);
  app.locals.io = io;
  server.listen(PORT, () => {
    console.log(`[server] Đang chạy tại http://localhost:${PORT}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] Nhận ${signal}, đang tắt...`);
    io.close(async () => {
      try {
        await app.locals.closeSessionStore();
        await sequelize.close();
      } catch (closeError) {
        console.error('[db] Lỗi khi đóng connection pool:', closeError.message);
        process.exitCode = 1;
      }
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
