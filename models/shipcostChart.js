module.exports = (sequelize, type) => sequelize.define('shipcostChart', {
  method: { type: type.STRING, allowNull: false },
  costdate: { type: type.INTEGER, allowNull: false },
  chart: { type: type.JSON, allowNull: false },
  sourceName: { type: type.STRING(255), allowNull: false },
  sourceHeaders: { type: type.JSON, allowNull: false },
}, { indexes: [{ fields: ['method', 'costdate', 'id'] }] });
