module.exports = (sequelize, type) => {
    return sequelize.define('shipcost', {
      uptoweight: type.INTEGER,
      method: type.STRING,
      cost: type.INTEGER,
      costdate: type.INTEGER
    });
  };
  