module.exports = (sequelize, type) => {
  return sequelize.define('trackhist0', {
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
