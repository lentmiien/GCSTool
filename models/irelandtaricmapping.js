module.exports = (sequelize, type) => {
  return sequelize.define('irelandtaricmapping', {
    mappingType: type.STRING,
    janCode: type.STRING,
    itemName: type.STRING,
    itemNameNormalized: type.STRING,
    sourceHsCode: type.STRING,
    taricCode: type.STRING,
    uses: {
      type: type.INTEGER,
      defaultValue: 1,
    },
  }, {
    indexes: [
      {
        name: 'idx_ire_taric_jan',
        fields: ['mappingType', 'janCode'],
      },
      {
        name: 'idx_ire_taric_name_hs',
        fields: ['mappingType', 'itemNameNormalized', 'sourceHsCode'],
      },
    ],
  });
};
