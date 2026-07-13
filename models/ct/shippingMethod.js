module.exports = (sequelize, type) => {
  return sequelize.define('shipping_method', {
    name: {
      type: type.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'shipping_methods',
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
    ],
  });
};
