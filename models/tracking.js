module.exports = (sequelize, type) => {
  return sequelize.define('tracking', {
    //ordernr: type.BIGINT,
    tracking: type.STRING,
    carrier: type.STRING,
    //method: type.STRING,
    country: type.STRING,
    addeddate: type.BIGINT,
    lastchecked: type.BIGINT,
    status: type.STRING,
    shippeddate: type.BIGINT,
    delivereddate: type.BIGINT,
    delivered: type.BOOLEAN,
    data: type.TEXT,
    grouplabel: type.INTEGER,
  });
};
