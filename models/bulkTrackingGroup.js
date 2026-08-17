module.exports = (sequelize, type) => {
  return sequelize.define('bulkTrackingGroup', {
    name: {
      type: type.STRING(120),
      allowNull: false,
    },
    explanation: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    createdBy: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    archivedAt: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    archiveReason: {
      type: type.STRING(20),
      allowNull: false,
      defaultValue: '',
    },
    lastMembershipChangeAt: {
      type: type.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'bulk_tracking_groups',
    indexes: [
      { fields: ['archivedAt'] },
      { fields: ['createdAt'] },
    ],
  });
};
