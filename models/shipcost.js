module.exports = (sequelize, type) => {
    return sequelize.define('shipcost', {
      uptoweight_g: type.INTEGER,
      method: type.STRING,
      cost: type.INTEGER,
      costdate: type.INTEGER,
      zone: type.STRING
    });
  };
  