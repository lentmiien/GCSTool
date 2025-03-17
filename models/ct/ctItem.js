module.exports = (sequelize, type) => {
  return sequelize.define('ctItem', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    file_id: {
      type: type.INTEGER,
      allowNull: true,
    },
    item_code: {
      type: type.STRING,
      allowNull: false,
    },
    defect: {
      type: type.STRING,
      allowNull: true,
    },
    item_cost: {
      type: type.INTEGER,
      allowNull: false,
    },
    created_date: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.fn('NOW'),
    },
  }, {
    indexes: [
      {
        fields: ['case_id'],
      },
    ],
  });
};
