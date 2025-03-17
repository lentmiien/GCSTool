module.exports = (sequelize, type) => {
  return sequelize.define('ctProcessedBy', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    staff: {
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
