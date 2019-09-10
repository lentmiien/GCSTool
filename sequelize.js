const fs = require('fs');
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
Entry.Content = Entry.hasMany(Content);
Staff.Schedule = Staff.hasMany(Schedule);

// Create all necessary tables
sequelize.sync().then(() => {
  console.log(`Database & tables created!`);

  //////////////////////////////////////////////////////////////////////////
  // Check if tables are empty -> Load "Master.json" -> Store in database //
  //////////////////////////////////////////////////////////////////////////
  Entry.findAll().then(d => {
    if (d.length > 0) {
      console.log('Database status: Normal');
    } else {
      console.log('Database status: Empty -> Load backup data');
      var obj = JSON.parse(fs.readFileSync('./public/Master.json', 'utf8'));
      // entries
      obj.Entries.forEach(d => {
        const input_data = {
          creator: 'NewUser',
          category: d.type,
          ismaster: 1,
          tag: d.category,
          team: d.team,
          title: d.data.Title,
          contents: []
        };
        for (let i = 0; i < d.data.Content.length; i++) {
          input_data.contents.push({ data: d.data.Content[i] });
        }
        Entry.create(input_data, { include: Entry.Content });
      });
      // staff + daysoff
      obj.Schedule.staff.forEach((d, i) => {
        const input_data = {
          name: d.name,
          dayoff1: d.daysoff[0],
          dayoff2: d.daysoff[1],
          schedules: []
        };
        for (let j = 0; j < obj.Schedule.daysoff.length; j++) {
          if (obj.Schedule.daysoff[j].staff == i) {
            input_data.schedules.push({
              date: obj.Schedule.daysoff[j].year + '-' + obj.Schedule.daysoff[j].month + '-' + obj.Schedule.daysoff[j].date,
              work: obj.Schedule.daysoff[j].work ? 1 : 0
            });
          }
        }
        Staff.create(input_data, { include: Staff.Schedule });
      });
      // holidays
      obj.Schedule.holidays.forEach(d => {
        const input_data = {
          date: d.year + '-' + d.month + '-' + d.date
        };
        Holiday.create(input_data);
      });
    }
  });
  //////////////////////////////////////////////////////////////////////////
  // Check if tables are empty -> Load "Master.json" -> Store in database //
  //////////////////////////////////////////////////////////////////////////
});

// Export models
module.exports = {
  Entry,
  Content,
  Staff,
  Holiday,
  Schedule
};