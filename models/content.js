module.exports = (sequelize, type) => {
  return sequelize.define('content', {
    data: type.LONGTEXT
  });
};
