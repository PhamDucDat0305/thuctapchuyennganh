const { Sequelize } = require('sequelize');
const { buildConfig } = require('./database');

function buildSequelizeConfig() {
  const db = buildConfig();
  const options = db.options || {};
  const dialectOptions = {
    options: {
      encrypt: options.encrypt,
      trustServerCertificate: options.trustServerCertificate,
    },
  };

  if (options.instanceName) {
    dialectOptions.options.instanceName = options.instanceName;
  }

  return {
    database: db.database,
    username: db.user,
    password: db.password,
    options: {
      dialect: 'mssql',
      host: db.server,
      ...(db.port ? { port: db.port } : {}),
      dialectOptions,
      logging: false,
      pool: {
        max: db.pool?.max ?? 10,
        min: db.pool?.min ?? 0,
        idle: db.pool?.idleTimeoutMillis ?? 30000,
        acquire: db.connectionTimeout ?? 15000,
      },
      define: {
        schema: 'dbo',
        freezeTableName: true,
        timestamps: false,
      },
    },
  };
}

function createSequelize() {
  const config = buildSequelizeConfig();
  return new Sequelize(config.database, config.username, config.password, config.options);
}

module.exports = { buildSequelizeConfig, createSequelize };
