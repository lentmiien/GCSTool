module.exports = (sequelize, type) => {
  return sequelize.define('ctCase', {
    order: {
      type: type.INTEGER,
      allowNull: false,
    },
    customer_id: {
      type: type.STRING,
      allowNull: false,
    },
    tracking: {
      type: type.STRING,
      allowNull: false,
    },
    shipping_method: {
      type: type.STRING,
      allowNull: false,
    },
    shipped_date: {
      type: type.DATE,
      allowNull: false,
    },
    type: {
      type: type.STRING,
      allowNull: false,
    },
    country: {
      type: type.STRING,
      allowNull: false,
    },
    started: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.fn('NOW'),
    },
    ended: {
      type: type.DATE,
      allowNull: true,
    },
    deadline: {
      type: type.DATE,
      allowNull: true,
    },
    staff_in_charge: {
      type: type.STRING,
      allowNull: false,
    },
    status: {
      type: type.STRING,
      allowNull: false,
    },
    solution: {
      type: type.STRING,
      allowNull: true,
    },
    cancel_reason: {
      type: type.STRING,
      allowNull: true,
    },
  }, {
    indexes: [
      {
        fields: ['customer_id'],
      },
    ],
  });
};
