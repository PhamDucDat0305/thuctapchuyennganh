const session = require('express-session');
const { Op } = require('sequelize');
const { sequelize, SessionRecord } = require('../models');

class SequelizeSessionStore extends session.Store {
  constructor({ ttl, pruneInterval = 10 * 60 * 1000 } = {}) {
    super();
    this.ttl = ttl || 30 * 60 * 1000;
    this.pruneTimer = setInterval(() => {
      this.pruneExpired().catch((error) => this.emit('error', error));
    }, pruneInterval);
    this.pruneTimer.unref?.();
  }

  databaseExpiry() {
    return sequelize.literal(`DATEADD(MILLISECOND,${this.ttl},GETDATE())`);
  }

  notExpired() {
    return { [Op.gt]: sequelize.literal('GETDATE()') };
  }

  get(sid, callback) {
    const done = callback || (() => {});
    SessionRecord.findOne({
      where: { sid, expires: this.notExpired() },
      attributes: ['session'],
      raw: true,
    }).then((row) => {
      if (!row) return done(null, null);
      try { return done(null, JSON.parse(row.session)); }
      catch (error) { return done(error); }
    }).catch(done);
  }

  set(sid, value, callback) {
    const done = callback || (() => {});
    SessionRecord.upsert({ sid, session: JSON.stringify(value), expires: this.databaseExpiry() })
      .then(() => done(null))
      .catch(done);
  }

  touch(sid, value, callback) {
    const done = callback || (() => {});
    SessionRecord.update({ expires: this.databaseExpiry() }, { where: { sid }, silent: true })
      .then(() => done(null))
      .catch(done);
  }

  destroy(sid, callback) {
    const done = callback || (() => {});
    SessionRecord.destroy({ where: { sid } }).then(() => done(null)).catch(done);
  }

  clear(callback) {
    const done = callback || (() => {});
    SessionRecord.destroy({ truncate: true }).then(() => done(null)).catch(done);
  }

  length(callback) {
    const done = callback || (() => {});
    SessionRecord.count({ where: { expires: this.notExpired() } })
      .then((count) => done(null, count))
      .catch(done);
  }

  all(callback) {
    const done = callback || (() => {});
    SessionRecord.findAll({
      where: { expires: this.notExpired() },
      attributes: ['session'],
      raw: true,
    }).then((rows) => done(null, rows.map((row) => JSON.parse(row.session))))
      .catch(done);
  }

  async pruneExpired() {
    return SessionRecord.destroy({ where: { expires: { [Op.lte]: sequelize.literal('GETDATE()') } } });
  }

  close() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = null;
  }
}

module.exports = SequelizeSessionStore;
