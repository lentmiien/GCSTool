module.exports = (sequelize, type) => {
  return sequelize.define('irelandworksummary', {
    orderNumber: {
      type: type.STRING,
      allowNull: false,
    },
    toyRemovedCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    taricUpdateCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    uneditedCount: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    trackingNumber: {
      type: type.STRING,
      allowNull: false,
      defaultValue: '',
    },
    addedDate: {
      type: type.STRING,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        name: 'idx_ire_work_summary_order',
        unique: true,
        fields: ['orderNumber'],
      },
      {
        name: 'idx_ire_work_summary_added_date',
        fields: ['addedDate'],
      },
    ],
  });
};
