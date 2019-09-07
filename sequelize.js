const Sequelize = require('sequelize');
// Load models
const UserModel = require('./models/user');

// Connect to DB
const sequelize = new Sequelize('gcstool', 'root', '', {
  dialect: 'mysql'
});

// Attach DB to model
const User = UserModel(sequelize, Sequelize);

// Create all necessary tables
sequelize.sync().then(() => {
  console.log(`Database & tables created!`);
});

// Export models
module.exports = {
  User
};
