module.exports = (sequelize, type) => {
  return sequelize.define('pmt_version', {
    entry_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    content_md: {
      type: type.STRING,
      allowNull: false,
    },
    version_number: {
      type: type.INTEGER,
      allowNull: false,
    },
    created_by: {
      type: type.STRING,
      allowNull: false,
    },
  });
};
