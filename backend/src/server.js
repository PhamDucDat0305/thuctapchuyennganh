require('dotenv').config();

const app = require('./app');
const { connectDatabase, closeDatabase } = require('./config/database');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await connectDatabase();
    console.log('[db] Đã kết nối SQL Server');
  } catch (err) {
    console.error('[db] Không kết nối được SQL Server:', err.message);
    console.error('     Kiểm tra .env, SQL Server, TCP/IP và quyền của tài khoản SQL.');
    process.exitCode = 1;
    return;
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] Đang chạy tại http://localhost:${PORT}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] Nhận ${signal}, đang tắt...`);
    server.close(async (err) => {
      if (err) console.error('[server] Lỗi khi đóng HTTP server:', err.message);
      try {
        await app.locals.closeSessionStore();
        await closeDatabase();
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
