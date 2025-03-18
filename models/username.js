module.exports = (sequelize, type) => {
  return sequelize.define('username', {
    userid: type.STRING,
    name: type.STRING,
  });
};
