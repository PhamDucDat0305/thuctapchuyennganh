const authenticateSocket = require('./authenticate-socket');
const messagesService = require('../services/messages.service');
const { setSocketServer, publishMessage } = require('../services/messages-events');

const SEND_LIMIT = 30;
const SEND_WINDOW_MS = 60 * 1000;
const sendEvents = new Map();

function attachChatSocket(io, sessionMiddleware) {
  io.engine.use(sessionMiddleware);
  io.use(authenticateSocket);
  setSocketServer(io);

  io.on('connection', (socket) => {
    const user = socket.data.user;
    // The server derives the only room this socket may join from its session.
    socket.join(`user:${user.id}`);
    const sessionCheck = setInterval(() => {
      authenticateSocket.revalidateSocket(socket).catch(() => socket.disconnect(true));
    }, 60 * 1000);
    sessionCheck.unref?.();

    socket.on('message:send', async (payload = {}, acknowledge) => {
      const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
      const now = Date.now();
      const recent = (sendEvents.get(user.id) || []).filter((time) => now - time < SEND_WINDOW_MS);
      if (recent.length >= SEND_LIMIT) {
        sendEvents.set(user.id, recent);
        return ack({ ok: false, status: 429, error: 'Bạn đang gửi tin quá nhanh. Vui lòng thử lại sau.' });
      }
      recent.push(now);
      sendEvents.set(user.id, recent);
      try {
        if (!await authenticateSocket.revalidateSocket(socket, true)) {
          return ack({ ok: false, status: 401, error: 'Phiên đăng nhập không còn hiệu lực' });
        }
        const message = await messagesService.send({ user, receiverId: payload.receiverId, content: payload.content });
        publishMessage(message);
        return ack({ ok: true, message });
      } catch (error) {
        return ack({ ok: false, status: error.status || 500, error: error.message || 'Không gửi được tin nhắn' });
      }
    });

    socket.on('disconnect', async () => {
      clearInterval(sessionCheck);
      try {
        const sockets = await io.in(`user:${user.id}`).fetchSockets();
        if (!sockets.length) sendEvents.delete(user.id);
      } catch (_) { /* rate-limit state will be cleared on the next request */ }
    });
  });
}

module.exports = attachChatSocket;
