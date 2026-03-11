module.exports = (sequelize, type) => {
  return sequelize.define('case', {
    order_number: {
      type: type.STRING,
      allowNull: false,
      unique: true,
    },
    customer_id: {
      type: type.STRING,
      allowNull: true,
    },
    customer_complaint: {
      type: type.STRING,
      allowNull: true,
    },
    customer_complaint_edit: {
      type: type.STRING,
      allowNull: true,
    },
    customer_complaint_comment: {
      type: type.TEXT,
      allowNull: true,
    },
    shipping_method: {
      type: type.STRING,
      allowNull: true,
    },
    shipping_date: {
      type: type.DATEONLY,
      allowNull: true,
    },
    complaint_date: {
      type: type.DATEONLY,
      allowNull: false,
    },
    defect_items: {
      type: type.STRING,
      allowNull: true,
    },
    defect_description: {
      type: type.TEXT,
      allowNull: true,
    },
    solution: {
      type: type.STRING,
      allowNull: true,
    },
    solved_date: {
      type: type.DATEONLY,
      allowNull: true,
    },
  }, {
    tableName: 'cases',
    indexes: [
      {
        unique: true,
        fields: ['order_number'],
      },
      {
        fields: ['customer_id'],
      },
      {
        fields: ['solved_date'],
      },
    ],
  });
};
