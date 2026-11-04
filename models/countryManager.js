module.exports = (sequelize, type) => ({
  CountryManagerState: sequelize.define('CountryManagerState', {
    id: { type: type.INTEGER, primaryKey: true },
    revision: { type: type.INTEGER, allowNull: false, defaultValue: 0 },
  }),
  CountryManagerVersion: sequelize.define('CountryManagerVersion', {
    source: { type: type.STRING(20), allowNull: false },
    data: { type: type.JSON, allowNull: false },
    recordedAt: { type: type.DATE(3), allowNull: false },
    actor: { type: type.STRING, allowNull: false },
    note: { type: type.STRING, allowNull: false },
  }, { indexes: [{ fields: ['source', 'id'] }, { fields: ['recordedAt'] }] }),
});
