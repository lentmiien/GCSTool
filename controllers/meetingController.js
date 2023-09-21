/**************************
 *
 * Change from google-spreadsheet to database
 * Change to process changes/updates through socket.io, and send updates to all users
 *
 */

const e = require('express');

// Require necessary database models
const { Meeting, MeetingComment } = require('../sequelize');

exports.meeting_landing = async (req, res) => {
  Meeting.findAll().then((meetings) => {
    MeetingComment.findAll().then((comments) => {
      const meeting_lookup = [];
      meetings.forEach((m) => {
        meeting_lookup.push(m.id);
        m['date'] = m.updatedAt;
        m['comments'] = [];
      });
      comments.forEach((c) => {
        const index = meeting_lookup.indexOf(c.meeting_id);
        if (index >= 0) {
          meetings[index]['comments'].push(c);
          if (c.updatedAt > meetings[index].date) {
            meetings[index].date = c.updatedAt;
          }
        }
      });
      meetings.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
      });
      meetings.forEach((m) => {
        if ('comments' in m) {
          m['comments'].sort((a, b) => {
            if (a.updatedAt > b.updatedAt) return -1;
            if (a.updatedAt < b.updatedAt) return 1;
            return 0;
          });
        }
      });
      res.render('meeting', { meetings });
    });
  });
};
