const Sequelize = require('sequelize');
// Load models
const EntryModel = require('./models/entry');
const ContentModel = require('./models/content');
const StaffModel = require('./models/staff');
const HolidayModel = require('./models/holiday');
const ScheduleModel = require('./models/schedule');

// Connect to DB
const sequelize = new Sequelize('gcstool', 'root', '', {
  dialect: 'mysql'
});

// Attach DB to model
const Entry = EntryModel(sequelize, Sequelize);
const Content = ContentModel(sequelize, Sequelize);
const Staff = StaffModel(sequelize, Sequelize);
const Holiday = HolidayModel(sequelize, Sequelize);
const Schedule = ScheduleModel(sequelize, Sequelize);

// Create table relations
Entry.hasMany(Content);
Staff.hasMany(Schedule);

// Create all necessary tables
sequelize.sync().then(() => {
  console.log(`Database & tables created!`);
});

// Export models
module.exports = {
  Entry,
  Content,
  Staff,
  Holiday,
  Schedule
};
