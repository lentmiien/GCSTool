module.exports = (sequelize, type) => {
  return sequelize.define('ctRefund', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    file_id: {
      type: type.INTEGER,
      allowNull: true,
    },
    order: {
      type: type.INTEGER,
      allowNull: false,
    },
    type: {
      type: type.STRING,
      allowNull: false,
    },
    amount: {
      type: type.FLOAT,
      allowNull: false,
    },
    currency: {
      type: type.STRING,
      allowNull: false,
    },
    jpy_amount: {
      type: type.INTEGER,
      allowNull: false,
    },
    requested_date: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.fn('NOW'),
    },
    processed_date: {
      type: type.DATE,
      allowNull: true,
    },
    completed_date: {
      type: type.DATE,
      allowNull: true,
    },
    status: {
      type: type.STRING,
      allowNull: false,
    },
    method: {
      type: type.STRING,
      allowNull: false,
    },
    transaction_id: {
      type: type.STRING,
      allowNull: true,
    },
    refund_details: {
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
