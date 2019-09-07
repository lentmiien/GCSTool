const Sequelize = require('sequelize');
const sequelize = new Sequelize('gcstool', 'root', '', {
  dialect: 'mysql'
});

class User extends Sequelize.Model {}
User.init(
  {
    username: Sequelize.STRING,
    birthday: Sequelize.DATE
  },
  { sequelize, modelName: 'user' }
);

sequelize
  .sync()
  .then(() =>
    User.create({
      username: '田中',
      birthday: new Date(1980, 6, 20)
    })
  )
  .then(jane => {
    console.log(jane.toJSON());
  });

module.exports = User;
