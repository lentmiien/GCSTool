module.exports = (sequelize, type) => {
  return sequelize.define('ctAssistantRecord', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    order: {
      type: type.INTEGER,
      allowNull: false,
    },
    tracking: {
      type: type.STRING,
      allowNull: true,
    },
    type: {
      type: type.STRING,
      allowNull: false,
    },
    item_cost: {
      type: type.INTEGER,
      allowNull: false,
    },
    shipping_cost: {
      type: type.INTEGER,
      allowNull: true,
    },
    gst_cost: {
      type: type.INTEGER,
      allowNull: true,
    },
    status: {
      type: type.STRING,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        fields: ['case_id'],
      },
    ],
  });
};
