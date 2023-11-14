module.exports = (sequelize, type) => {
  return sequelize.define('content', {
    data: type.TEXT
  });
};
