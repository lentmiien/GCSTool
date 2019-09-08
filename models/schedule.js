module.exports = (sequelize, type) => {
  return sequelize.define('schedule', {
    name: type.DATEONLY,
    work: type.BOOLEAN
  });
};
