module.exports = (sequelize, type) => {
  return sequelize.define('irelandtaricexplanation', {
    taricCode: {
      type: type.STRING,
      allowNull: false,
    },
    explanation: {
      type: type.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  }, {
    indexes: [
      {
        name: 'idx_ire_taric_explanation_code',
        unique: true,
        fields: ['taricCode'],
      },
    ],
  });
};
