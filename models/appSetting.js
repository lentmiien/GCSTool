module.exports = (sequelize, type) => {
  return sequelize.define('app_setting', {
    key: {
      type: type.STRING(128),
      allowNull: false,
      unique: true,
    },
    value: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  }, {
    tableName: 'app_settings',
  });
};
