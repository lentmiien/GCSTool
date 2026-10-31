module.exports = (sequelize, type) => sequelize.define('japanPostSchedule', {
  cid: { type: type.INTEGER.UNSIGNED, allowNull: false },
  scheduledDate: { type: type.DATEONLY, allowNull: false },
  dueAt: { type: type.DATE, allowNull: false },
  status: { type: type.STRING(16), allowNull: false, defaultValue: 'pending' },
  finishedAt: type.DATE,
  error: type.STRING(500),
}, { indexes: [{ unique: true, fields: ['cid', 'scheduledDate'] }, { fields: ['status', 'dueAt'] }] });
