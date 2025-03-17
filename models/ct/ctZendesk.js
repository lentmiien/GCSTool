module.exports = (sequelize, type) => {
  return sequelize.define('ctZendesk', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    ticket: {
      type: type.INTEGER,
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
