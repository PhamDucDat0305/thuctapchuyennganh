const { Server } = require('socket.io');
const attachChatSocket = require('./chat.socket');

function createSocketServer(httpServer, sessionMiddleware) {
  const io = new Server(httpServer);
  attachChatSocket(io, sessionMiddleware);
  return io;
}

module.exports = { createSocketServer };
