module.exports = (sequelize, type) => {
  return sequelize.define('user', {
    userid: type.STRING,
    password: type.STRING,
    team: type.STRING,
    role: type.STRING,
  });
};
