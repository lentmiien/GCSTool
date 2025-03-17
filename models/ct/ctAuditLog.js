module.exports = (sequelize, type) => {
  return sequelize.define('ctAuditLog', {
    timestamp: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.fn('NOW'),
    },
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    staff: {
      type: type.STRING,
      allowNull: false,
    },
    log: {
      type: type.STRING,
      allowNull: false,
    },
    metadata: {
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
