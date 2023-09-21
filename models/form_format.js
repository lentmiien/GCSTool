module.exports = (sequelize, type) => {
  return sequelize.define('form_format', {
    title: type.STRING,
    label1: type.STRING,
    label2: type.STRING,
    label3: type.STRING,
    label4: type.STRING,
    group_label: type.STRING,
  });
};
