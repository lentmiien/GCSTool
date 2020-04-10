const fs = require('fs');
const Sequelize = require('sequelize');
// Load models
const EntryModel = require('./models/entry');
const ContentModel = require('./models/content');
const StaffModel = require('./models/staff');
const HolidayModel = require('./models/holiday');
const ScheduleModel = require('./models/schedule');
const Schedule2Model = require('./models/schedule2');
const UserModel = require('./models/user');

// Connect to DB
const sequelize = new Sequelize('gcs', process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});

// Attach DB to model
const Entry = EntryModel(sequelize, Sequelize);
const Content = ContentModel(sequelize, Sequelize);
const Staff = StaffModel(sequelize, Sequelize);
const Holiday = HolidayModel(sequelize, Sequelize);
const Schedule = ScheduleModel(sequelize, Sequelize);
const Schedule2 = Schedule2Model(sequelize, Sequelize);
const User = UserModel(sequelize, Sequelize);

const Op = Sequelize.Op;

// Create table relations
Entry.Content = Entry.hasMany(Content);
Staff.Schedule = Staff.hasMany(Schedule);
Staff.Schedule2 = Staff.hasMany(Schedule2);

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
  Schedule,
  Schedule2,
  User,
  Op,
};
