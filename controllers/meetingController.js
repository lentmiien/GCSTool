/**************************
 * 
 * version3 TODO
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
      meetings.forEach(m => meeting_lookup.push(m.id));
      comments.forEach(c => {
        const index = meeting_lookup.indexOf(c.meeting_id);
        if (index >= 0) {
          if ("comments" in meetings[index]) {
            meetings[index]["comments"].push(c);
          } else {
            meetings[index]["comments"] = [];
            meetings[index]["comments"].push(c);
          }
        }
      });
      meetings.sort((a,b) => {
        if (a.updatedDate < b.updatedDate) return -1;
        if (a.updatedDate > b.updatedDate) return 1;
        return 0;
      });
      res.render('meeting', { meetings });
    });
  });
};
