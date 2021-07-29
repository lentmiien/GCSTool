const e = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');

// Require necessary database models
const { User } = require('../sequelize');

const creds = {
  type: process.env.GSHEET_TYPE,
  project_id: process.env.GSHEET_PROJECT_ID,
  private_key_id: process.env.GSHEET_PRIVATE_KEY_ID,
  private_key: process.env.GSHEET_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.GSHEET_CLIENT_EMAIL,
  client_id: process.env.GSHEET_CLIENT_ID,
  auth_uri: process.env.GSHEET_AUTH_URI,
  token_uri: process.env.GSHEET_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GSHEET_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GSHEET_CLIENT_X509_CERT_URL,
};

exports.meeting_landing = async (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  const doc = new GoogleSpreadsheet(process.env.GSHEET_DOC_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  // Get todays date
  const d = new Date();

  // Comming from post new topic
  if (req.body.newtopic) {
    // In data
    const newcontent = {
      topic: req.body.newtopic + '(' + d.getTime() + ')', // Adding time stamp to ensure that all topics has a uinquly itentifiable name
      status: '新規',
      details: req.body.newdetails,
      lastupdated: Date.now(),
    };
    newcontent[req.body.newedit_user] = req.body.newmycomment;

    await sheet.addRow(newcontent);
  }

  // Get rows AFTER adding new content above
  const rows_raw = await sheet.getRows();
  const rows = rows_raw.sort((a, b) => {
    if (a.lastupdated > b.lastupdated) {
      return -1;
    } else if (a.lastupdated < b.lastupdated) {
      return 1;
    } else {
      return 0;
    }
  });

  // Comming from edit details
  if (req.body.edittopic) {
    rows.forEach((r) => {
      if (r.topic == req.body.edittopic) {
        r.status = req.body.editwho + req.body.editstatus;
        r.details = req.body.editdetails;
        r.lastupdated = Date.now();
        r.save();
      }
    });
  }

  // Comming from update comment
  if (req.body.topic) {
    rows.forEach((r) => {
      if (r.topic == req.body.topic) {
        r[req.body.edit_user] = req.body.mycomment;
        r.lastupdated = Date.now();
        r.save();
      }
    });
  }

  User.findAll().then((users) => {
    res.render('meeting', { rows, users: users, request: req.user });
  });
};

exports.new = async (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Get timestamp from link address req.params.timestamp
  const timestamp = req.params.timestamp;

  // Check which entries that are newer than provided timestamp
  const doc = new GoogleSpreadsheet(process.env.GSHEET_DOC_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  const rows = (await sheet.getRows()).filter((row) => row.lastupdated > timestamp);

  let new_entried = rows.length;

  // Return the number of updates to the user
  res.json({ new: new_entried });
};

/* TODO: Add cache for feedback
 * When adding, also add to cache, if cache is empty first fetch data from spreadsheet
 * When fetchin, return cache, or aquire data from spreadsheet if no cache
 */
const incident_cache = [];
const issue_cache = [];

exports.addfeedback = (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Access Spreadsheet
  const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
  doc.useServiceAccountAuth(creds).then(() => {
    doc.loadInfo().then(() => {
      const sheet = doc.sheetsByIndex[0];
      const now_time_stamp = Date.now();

      // If cache is empty, load data to cache and add new entry
      // else, just add new entry
      if (incident_cache.length == 0) {
        sheet.getRows().then(raw => {
          raw.forEach(row => {
            incident_cache.push({
              date: row.date,
              happiness: row.happiness,
              type: row.type,
              bug: row.bug,
              comment: row.comment,
              ticket: row.ticket,
              reported_by: row.reported_by,
              issue: row.issue,
              updated: row.updated,
            });
          });
          incident_cache.push({
            date: now_time_stamp,
            happiness: req.body.happiness,
            type: req.body.type,
            bug: req.body.bug,
            comment: req.body.comment,
            ticket: req.body.ticket,
            reported_by: req.user.userid,
            issue: 0,
            updated: now_time_stamp,
          });
        });
      } else {
        incident_cache.push({
          date: now_time_stamp,
          happiness: req.body.happiness,
          type: req.body.type,
          bug: req.body.bug,
          comment: req.body.comment,
          ticket: req.body.ticket,
          reported_by: req.user.userid,
          issue: 0,
          updated: now_time_stamp,
        });
      }

      // In data
      const newcontent = {
        date: Date.now(),
        happiness: req.body.happiness,
        type: req.body.type,
        bug: req.body.bug,
        comment: req.body.comment,
        ticket: req.body.ticket,
        reported_by: req.user.userid,
        issue: 0,
        updated: Date.now(),
      };
      sheet.addRow(newcontent);
    });
  });

  // Return the number of updates to the user
  res.json({ status: 'OK' });
};

exports.showfeedback = async (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Only need to access spreadsheet if no cache exists
  if (incident_cache.length == 0 || issue_cache.length == 0) {
    // Access spreadsheet
    const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    if (incident_cache.length == 0) {
      const incident = doc.sheetsByIndex[0];
      const raw = await incident.getRows();
      raw.forEach(row => {
        incident_cache.push({
          date: row.date,
          happiness: row.happiness,
          type: row.type,
          bug: row.bug,
          comment: row.comment,
          ticket: row.ticket,
          reported_by: row.reported_by,
          issue: row.issue,
          updated: row.updated,
        });
      });
    }

    if (issue_cache.length == 0) {
      const issue = doc.sheetsByIndex[1];
      const raw = await issue.getRows();
      raw.forEach(row => {
        issue_cache.push({
          issue_id: row.issue_id,
          issue: row.issue,
          comment: row.comment,
          solved: row.solved,
        });
      });
    }
  }

  // Incidents
  const incident_rows = incident_cache.map((x) => {
    return {
      date: x.date,
      happiness: x.happiness,
      type: x.type,
      bug: x.bug,
      comment: x.comment,
      ticket: x.ticket,
      reported_by: x.reported_by,
      issue: x.issue,
      issue_comment: '',
      updated: x.updated,
    };
  });

  // Issues
  const issue_rows = issue_cache.map((x) => {
    return {
      last_occured: 0,
      issue_id: x.issue_id,
      issue: x.issue,
      comment: x.comment,
      count90: 0,
      countall: 0,
      solved: x.solved,
    };
  });

  // Preprocess issues and incidents
  const _90_days_ago = Date.now() - (1000*60*60*24*90);
  incident_rows.forEach(i => {
    issue_rows.forEach(j => {
      if (i.issue == j.issue_id) {
        // Issue
        if (j.last_occured < i.date) {
          j.last_occured = i.date;
        }
        if (i.date > _90_days_ago) {
          j.count90++;
        }
        j.countall++;

        // Incident
        i.issue = j.issue;
        i.issue_comment = j.comment;
      }
    });
  });

  // Filter and sort incidents
  const incident_out = incident_rows.filter(ir => ir.date > _90_days_ago && (req.user.role == 'admin' || ir.reported_by.length == 0 || ir.reported_by == req.user.userid));
  incident_out.sort((a, b) => {
    if (a.updated > b.updated) {
      return -1;
    } else if (a.updated < b.updated) {
      return 1;
    } else {
      return 0;
    }
  });

  // Sort issues
  issue_rows.sort((a, b) => {
    if (a.last_occured > b.last_occured) {
      return -1;
    } else if (a.last_occured < b.last_occured) {
      return 1;
    } else {
      return 0;
    }
  });

  // Return the number of updates to the user
  res.render('feedback', { incidents: incident_out, issues: issue_rows });
};

exports.editissue = async (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Get timestamp from link address req.params.timestamp
  const id = req.params.id;

  if (id == '0') {
    res.render('feedback_editissue', { issues: [{
      issue_id: 0,
      issue: '',
      comment: '',
      solved: 'no'
    }] });
  } else {
    // Load spredsheet if no cache
    if (issue_cache.length == 0) {
      // Check which entries that are newer than provided timestamp
      const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
      await doc.useServiceAccountAuth(creds);
      await doc.loadInfo();

      const issue = doc.sheetsByIndex[1];
      const raw = await issue.getRows();
      raw.forEach(row => {
        issue_cache.push({
          issue_id: row.issue_id,
          issue: row.issue,
          comment: row.comment,
          solved: row.solved,
        });
      });
    }

    // Issues
    const issue_rows = issue_cache.filter(f => f.issue_id == id);

    // Return the number of updates to the user
    res.render('feedback_editissue', { issues: issue_rows });
  }
};

exports.editissue_post = (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Get timestamp from link address req.params.timestamp
  const id = req.body.issue_id;

  if (id == '0') {
    // Add new entry to cache before accessing spredsheet
    // In data
    const newcontent = {
      issue_id: Date.now(),
      issue: req.body.issue,
      comment: req.body.comment,
      solved: req.body.solved,
    };
    issue_cache.push(newcontent);

    // Access spreadsheet
    const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
    doc.useServiceAccountAuth(creds).then(() => {
      doc.loadInfo().then(() => {
        const sheet = doc.sheetsByIndex[1];
        sheet.addRow(newcontent);
      });
    });
  } else {
    // Update entry to cache before accessing spredsheet
    issue_cache.forEach(data => {
      if (data.issue_id == id) {
        data.issue = req.body.issue;
        data.comment = req.body.comment;
        data.solved = req.body.solved;
      }
    });

    // Access spreadsheet
    const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
    doc.useServiceAccountAuth(creds).then(() => {
      doc.loadInfo().then(() => {
        // Issues
        const issue = doc.sheetsByIndex[1];
        issue.getRows().then((issue_raw) => {
          issue_raw.forEach(row_data => {
            if (row_data.issue_id == id) {
              row_data.issue = req.body.issue;
              row_data.comment = req.body.comment;
              row_data.solved = req.body.solved;
              row_data.save();
            }
          });
        });
      });
    });
  }
  res.redirect('/meeting/feedback');
};

exports.editfeedback = (req, res) => {
  if (req.user.role == 'guest') {
    return res.json({status:"failed"});
  }

  const incident_id = req.body.incident_id;
  const issue_id = req.body.issue_id;

  // Update cache
  incident_cache.forEach(data => {
    if (data.date == incident_id) {
      data.issue = issue_id;
      data.updated = Date.now();
    }
  });

  // Check which entries that are newer than provided timestamp
  const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
  doc.useServiceAccountAuth(creds).then(() => {
    doc.loadInfo().then(() => {
      // Incidents
      const incident = doc.sheetsByIndex[0];
      incident.getRows().then(incident_raw => {
        incident_raw.forEach(row_data => {
          if (row_data.date == incident_id) {
            row_data.issue = issue_id;
            row_data.updated = Date.now();
            row_data.save();
          }
        });
      });
    });
  });

  res.json({status:"ok"});
};
