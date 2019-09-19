module.exports = (sequelize, type) => {
  return sequelize.define('schedule', {
    date: type.DATEONLY,
    work: type.BOOLEAN
  });
};
