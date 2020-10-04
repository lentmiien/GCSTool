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

exports.addfeedback = async (req, res) => {
  if (req.user.role == 'guest') {
    return res.redirect('/');
  }

  // Get timestamp from link address req.params.timestamp
  const timestamp = req.params.timestamp;

  // Check which entries that are newer than provided timestamp
  const doc = new GoogleSpreadsheet('19dqIEvq8V3A2GKklr9_z5q4r3FZzw7c126QwNX_9oxc');
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  // In data
  const newcontent = {
    date: (new Date()).toLocaleDateString(),
    happiness: req.body.happiness,
    type: req.body.type,
    bug: req.body.bug,
    comment: req.body.comment,
  };
  await sheet.addRow(newcontent);

  // Return the number of updates to the user
  res.json({ status: 'OK' });
};
