module.exports = (sequelize, type) => {
  return sequelize.define('irelandworksummary', {
    countryCode: {
      type: type.STRING(2),
      allowNull: false,
      defaultValue: 'IE',
    },
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
  });
};
