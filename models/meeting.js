module.exports = (sequelize, type) => {
  return sequelize.define('meeting', {
    title: type.STRING,
    created_by: type.STRING,
    content: type.TEXT,
    status: type.STRING,
  });
};
