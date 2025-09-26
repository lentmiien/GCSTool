module.exports = (sequelize, type) => {
  return sequelize.define('ctApproverPrivilege', {
    user_id: {
      type: type.STRING,
      allowNull: false,
    },
    level: {
      type: type.STRING,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'level'],
      },
    ],
  });
};
