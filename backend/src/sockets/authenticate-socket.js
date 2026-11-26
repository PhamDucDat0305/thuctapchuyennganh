const { User } = require('../models');

async function findActiveUser(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role', 'status', 'adminLocked'] });
  if (!user || user.status !== 'active' || user.adminLocked || !['candidate', 'employer'].includes(user.role)) return null;
  return { id: Number(user.id), role: user.role };
}

function reloadSession(session) {
  return new Promise((resolve) => {
    if (!session || typeof session.reload !== 'function') return resolve(false);
    session.reload((error) => resolve(!error));
  });
}

async function revalidateSocket(socket, renew = false) {
  const session = socket.request.session;
  if (!await reloadSession(session) || Number(session.userId) !== socket.data.user?.id) {
    socket.disconnect(true);
    return false;
  }
  const user = await findActiveUser(session.userId);
  if (!user || user.id !== socket.data.user.id) {
    socket.disconnect(true);
    return false;
  }
  if (renew) {
    await new Promise((resolve, reject) => session.save((error) => error ? reject(error) : resolve()));
  }
  return true;
}

async function authenticateSocket(socket, next) {
  try {
    const session = socket.request.session;
    const userId = session?.userId;
    if (!userId) return next(new Error('UNAUTHORIZED'));
    const user = await findActiveUser(userId);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

authenticateSocket.revalidateSocket = revalidateSocket;
module.exports = authenticateSocket;
