const repository = require('../repositories/test.repository');

async function checkDatabase() {
  const databaseResponded = await repository.pingDatabase();
  return {
    ok: databaseResponded,
    message: databaseResponded
      ? 'Backend và SQL Server đang hoạt động.'
      : 'SQL Server chưa phản hồi.',
  };
}

module.exports = { checkDatabase };
