module.exports = (sequelize, type) => {
  return sequelize.define('trackingMonitorEntry', {
    groupId: {
      type: type.INTEGER,
      allowNull: false,
    },
    tracking: {
      type: type.STRING,
      allowNull: false,
    },
    addeddate: {
      type: type.BIGINT,
      allowNull: false,
    },
    cachedTrackingId: {
      type: type.INTEGER,
      allowNull: true,
    },
    cachedMatchCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    cachedSelectionReason: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedCountry: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedStatus: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedShippeddate: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    cachedDelivereddate: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    cachedDelivered: {
      type: type.BOOLEAN,
      allowNull: true,
    },
    cachedGrouplabel: {
      type: type.INTEGER,
      allowNull: true,
    },
    cachedDeliveryOutcome: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedDeliveryCountry: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedDeliveryLocation: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    cachedDeliveryEventDescription: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    cachedDeliveryEventTimestamp: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    cachedHistoryTable: {
      type: type.INTEGER,
      allowNull: true,
    },
    cachedAt: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'tracking_monitor_entries',
    indexes: [
      {
        unique: true,
        fields: ['groupId', 'tracking'],
      },
      {
        fields: ['tracking'],
      },
      {
        fields: ['groupId'],
      },
    ],
  });
};
