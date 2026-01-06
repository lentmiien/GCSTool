module.exports = (sequelize, type) => {
  return sequelize.define('trackhist3', {
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
