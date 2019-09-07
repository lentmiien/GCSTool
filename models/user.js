module.exports = (sequelize, type) => {
  return sequelize.define('user', {
    username: type.STRING,
    birthday: type.DATE
  });
};
