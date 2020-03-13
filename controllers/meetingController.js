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
  client_x509_cert_url: process.env.GSHEET_CLIENT_X509_CERT_URL
};

exports.meeting_landing = async (req, res) => {
  if (req.body.role == 'guest') {
    return res.redirect('/');
  }

  const doc = new GoogleSpreadsheet(process.env.GSHEET_DOC_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  // Get todays date
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1);
  const date = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
  const today = year + '-' + month + '-' + date;

  // Comming from post new topic
  if (req.body.newtopic) {
    // In data
    const newcontent = {
      topic: req.body.newtopic + '(' + d.getTime() + ')', // Adding time stamp to ensure that all topics has a uinquly itentifiable name
      status: '新規',
      details: req.body.newdetails,
      lastupdated: today
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
    rows.forEach(r => {
      if (r.topic == req.body.edittopic) {
        r.status = req.body.editwho + req.body.editstatus;
        r.details = req.body.editdetails;
        r.lastupdated = today;
        r.save();
      }
    });
  }

  // Comming from update comment
  if (req.body.topic) {
    rows.forEach(r => {
      if (r.topic == req.body.topic) {
        r[req.body.edit_user] = req.body.mycomment;
        r.lastupdated = today;
        r.save();
      }
    });
  }

  User.findAll().then(users => {
    res.render('meeting', { rows, users: users, request: req.body });
  });
};
