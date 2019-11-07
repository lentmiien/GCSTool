module.exports = (sequelize, type) => {
  return sequelize.define('schedule2', {
    date: type.DATEONLY,
    work: type.STRING
  });
};
