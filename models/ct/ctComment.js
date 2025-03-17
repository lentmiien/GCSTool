module.exports = (sequelize, type) => {
  return sequelize.define('ctComment', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    timestamp: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.fn('NOW'),
    },
    staff: {
      type: type.STRING,
      allowNull: false,
    },
    comment: {
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
