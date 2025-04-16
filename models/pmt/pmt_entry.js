module.exports = (sequelize, type) => {
  return sequelize.define('pmt_entry', {
    type: {
      type: type.STRING,
      allowNull: false,
    },
    title: {
      type: type.STRING,
      allowNull: false,
    },
    content_md: {
      type: type.STRING,
      allowNull: false,
    },
    current_version: {
      type: type.INTEGER,
      allowNull: false,
    },
    category: {
      type: type.STRING,
      allowNull: false,
    },
  });
};
