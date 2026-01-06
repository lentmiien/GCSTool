module.exports = (sequelize, type) => {
  return sequelize.define('trackhist2', {
    tracking: {
        type: type.STRING,
        primaryKey: true
    },
    data: type.TEXT
  },
  {
    timestamps: false
  });
};
