module.exports = (sequelize, type) => {
  return sequelize.define('staff', {
    name: type.STRING,
    // dayoff1: type.INTEGER,
    // dayoff2: type.INTEGER,

    // Group name
    // group: type.STRING,

    // Normal status per day (normal schedule)
    day0: type.STRING,
    day1: type.STRING,
    day2: type.STRING,
    day3: type.STRING,
    day4: type.STRING,
    day5: type.STRING,
    day6: type.STRING,
  });
};
