module.exports = (sequelize, type) => {
  return sequelize.define('dhl_compensation_entry', {
    order_number: {
      type: type.STRING,
      allowNull: false,
    },
    tracking_number: {
      type: type.STRING,
      allowNull: false,
    },
    compensation_amount_jpy: {
      type: type.INTEGER,
      allowNull: false,
    },
    expected_transaction_date: {
      type: type.DATEONLY,
      allowNull: true,
    },
    transaction_date: {
      type: type.DATEONLY,
      allowNull: true,
    },
    completed: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_by: {
      type: type.STRING,
      allowNull: false,
    },
    updated_by: {
      type: type.STRING,
      allowNull: false,
    },
  }, {
    indexes: [
      { fields: ['completed'] },
      { fields: ['transaction_date'] },
      { fields: ['tracking_number'] },
      { fields: ['order_number'] },
    ],
  });
};
