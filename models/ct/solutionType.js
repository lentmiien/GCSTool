module.exports = (sequelize, type) => {
  return sequelize.define('solution_type', {
    name: {
      type: type.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'solution_types',
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
    ],
  });
};
