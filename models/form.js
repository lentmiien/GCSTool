module.exports = (sequelize, type) => {
  return sequelize.define('form', {
    order: type.INTEGER,
    tracking: type.STRING,
    processed_by: type.STRING,
    added_date: type.BIGINT,
    cost: type.INTEGER,
    currency: type.STRING,
    support_id: type.STRING,
    group_label: type.STRING,
  });
};
