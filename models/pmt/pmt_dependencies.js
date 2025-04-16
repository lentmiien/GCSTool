module.exports = (sequelize, type) => {
  return sequelize.define('pmt_dependencies', {
    parent_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    child_id: {
      type: type.INTEGER,
      allowNull: false,
    },
  });
};
