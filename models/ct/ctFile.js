module.exports = (sequelize, type) => {
  return sequelize.define('ctFile', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    type: {
      type: type.STRING,
      allowNull: false,
    },
    filename: {
      type: type.STRING,
      allowNull: false,
    },
    uploaded_date: {
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
