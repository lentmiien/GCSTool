module.exports = (sequelize, type) => {
  return sequelize.define('bulkTrackingEntry', {
    groupId: {
      type: type.INTEGER,
      allowNull: false,
    },
    tracking: {
      type: type.STRING,
      allowNull: false,
    },
    addedAt: {
      type: type.BIGINT,
      allowNull: false,
    },
    addedBy: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
  }, {
    tableName: 'bulk_tracking_entries',
    indexes: [
      {
        unique: true,
        fields: ['groupId', 'tracking'],
      },
      { fields: ['groupId'] },
      { fields: ['tracking'] },
    ],
  });
};
