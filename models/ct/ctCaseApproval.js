module.exports = (sequelize, type) => {
  return sequelize.define('ctCaseApproval', {
    case_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    approval_type: {
      type: type.STRING,
      allowNull: false,
    },
    approved_by: {
      type: type.STRING,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['case_id', 'approval_type'],
      },
      {
        fields: ['approved_by'],
      },
    ],
  });
};
