module.exports = (sequelize, type) => {
  return sequelize.define('return_shipping_cost_analytics', {
    category: {
      type: type.STRING(128),
      allowNull: false,
    },
    country: {
      type: type.STRING(128),
      allowNull: false,
    },
    currency: {
      type: type.STRING(8),
      allowNull: false,
    },
    weightInterval: {
      type: type.STRING(32),
      allowNull: false,
    },
    intervalStartKg: {
      type: type.INTEGER,
      allowNull: false,
    },
    intervalEndKg: {
      type: type.INTEGER,
      allowNull: false,
    },
    entryCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    p95Amount: {
      type: type.DECIMAL(15, 4),
      allowNull: true,
    },
    p95AmountDisplay: {
      type: type.STRING(64),
      allowNull: false,
      defaultValue: '',
    },
    guardrail: {
      type: type.STRING(128),
      allowNull: false,
      defaultValue: '',
    },
    rawP95Amount: {
      type: type.DECIMAL(15, 4),
      allowNull: true,
    },
    cappedP95Amount: {
      type: type.DECIMAL(15, 4),
      allowNull: true,
    },
    generatedAt: {
      type: type.DATE,
      allowNull: false,
    },
  }, {
    tableName: 'return_shipping_cost_analytics',
    indexes: [
      {
        name: 'uniq_return_ship_cost_analytics_row',
        unique: true,
        fields: ['category', 'country', 'currency', 'intervalStartKg'],
      },
      {
        name: 'idx_return_ship_cost_analytics_country',
        fields: ['country'],
      },
      {
        name: 'idx_return_ship_cost_analytics_generated',
        fields: ['generatedAt'],
      },
    ],
  });
};
