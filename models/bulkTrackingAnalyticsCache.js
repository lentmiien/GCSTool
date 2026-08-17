module.exports = (sequelize, type) => {
  return sequelize.define('bulkTrackingAnalyticsCache', {
    groupId: {
      type: type.INTEGER,
      allowNull: false,
      unique: true,
    },
    generatedAt: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    schemaVersion: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    summaryJson: {
      type: type.TEXT('medium'),
      allowNull: false,
      defaultValue: '{}',
    },
    reportJson: {
      type: type.TEXT('long'),
      allowNull: false,
    },
  }, {
    tableName: 'bulk_tracking_analytics_cache',
    indexes: [
      { fields: ['generatedAt'] },
    ],
  });
};
