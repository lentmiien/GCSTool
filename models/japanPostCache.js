module.exports = (sequelize, type) => sequelize.define('japanPostCache', {
  cid: { type: type.INTEGER.UNSIGNED, allowNull: false },
  data: { type: type.JSON, allowNull: false },
  detectedAt: { type: type.DATE, allowNull: false },
  lastCheckedAt: { type: type.DATE, allowNull: false },
}, { indexes: [{ fields: ['cid', 'id'] }, { fields: ['detectedAt'] }] });
