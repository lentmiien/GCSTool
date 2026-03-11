module.exports = (sequelize, type) => {
  return sequelize.define('complaint_type', {
    name: {
      type: type.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'complaint_types',
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
    ],
  });
};
