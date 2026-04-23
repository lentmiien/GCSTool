module.exports = (sequelize, type) => {
  return sequelize.define('trackingMonitorShortcut', {
    label: {
      type: type.STRING,
      allowNull: false,
    },
    groupIds: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  }, {
    tableName: 'tracking_monitor_shortcuts',
  });
};
