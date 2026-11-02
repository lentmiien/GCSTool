module.exports = (sequelize, type) => sequelize.define('japanPostCsvCache', {
  countryCode: { type: type.STRING(2), allowNull: false },
  data: { type: type.JSON, allowNull: false },
  sourceName: { type: type.STRING(255), allowNull: false },
  detectedAt: { type: type.DATE, allowNull: false },
  lastCheckedAt: { type: type.DATE, allowNull: false },
}, { indexes: [{ fields: ['countryCode', 'id'] }, { fields: ['detectedAt'] }] });
