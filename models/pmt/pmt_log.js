module.exports = (sequelize, type) => {
  return sequelize.define('pmt_log', {
    action: {
      type: type.STRING,
      allowNull: false,
    },
    entry_id: {
      type: type.INTEGER,
      allowNull: false,
    },
    action_by: {
      type: type.STRING,
      allowNull: false,
    },
    details: {
      type: type.STRING,
      allowNull: false,
    },
  });
};
