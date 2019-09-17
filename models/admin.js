module.exports = (sequelize, type) => {
  return sequelize.define('admin', {
    userid: type.STRING
  });
};
