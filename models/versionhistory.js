module.exports = (sequelize, type) => {
  return sequelize.define('versionhistory', {
    version: {
      type: type.STRING,
      allowNull: false,
    },
    releaseDate: {
      type: type.STRING,
      allowNull: true,
    },
    updateDate: {
      type: type.STRING,
      allowNull: true,
    },
    sortOrder: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    changesJson: {
      type: type.TEXT('long'),
      allowNull: false,
    },
  }, {
    indexes: [
      {
        name: 'idx_versionhistory_version',
        unique: true,
        fields: ['version'],
      },
      {
        name: 'idx_versionhistory_sort',
        fields: ['sortOrder'],
      },
    ],
  });
};
