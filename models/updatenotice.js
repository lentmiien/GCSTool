module.exports = (sequelize, type) => {
  return sequelize.define('updatenotice', {
    date: type.STRING,
    message: type.TEXT,
  });
};
