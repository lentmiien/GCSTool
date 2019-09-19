module.exports = (sequelize, type) => {
  return sequelize.define('entry', {
    creator: type.STRING,
    category: type.STRING,
    ismaster: type.BOOLEAN,
    tag: type.STRING,
    team: type.STRING,
    title: type.STRING
  });
};
