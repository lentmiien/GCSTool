module.exports = (sequelize, type) => {
  return sequelize.define('trackingMonitorGroup', {
    label: {
      type: type.STRING,
      allowNull: false,
    },
    note: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    entryCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastViewedAt: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'tracking_monitor_groups',
  });
};
