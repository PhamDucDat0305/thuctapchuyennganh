let io = null;
function setSocketServer(server) { io = server; }
function publishMessage(message) {
  if (!io || !message) return;
  io.to([`user:${message.senderId}`, `user:${message.receiverId}`]).emit('message:new', message);
}
function disconnectUser(userId) {
  if (io && userId) io.in(`user:${Number(userId)}`).disconnectSockets(true);
}
module.exports = { setSocketServer, publishMessage, disconnectUser };
