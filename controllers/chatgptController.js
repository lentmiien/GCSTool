const chatGPT = require('../utils/ChatGPT');
const { Chatmsg } = require('../sequelize');

/* Chatmsg
role: type.STRING,
content: type.STRING,
tokens: type.INTEGER,
timestamp: type.BIGINT,
threadid: type.BIGINT,
*/

exports.index = async (req, res) => {
  // GET
  // /
  const data = await Chatmsg.findAll();
  const display = {};
  const keys = [];
  data.forEach((d) => {
    if (d.threadid in display) {
      display[d.threadid].push(d);
    } else {
      display[d.threadid] = [];
      display[d.threadid].push(d);
      keys.push(d.threadid);
    }
  });

  keys.forEach((key) => {
    display[key].sort((a, b) => {
      if (a.timestamp < b.timestamp) return -1;
      if (a.timestamp > b.timestamp) return 1;
      return 0;
    });
  });

  res.render('chatgpt', { display, keys, chat: req.query.tid ? req.query.tid : '0' });
};

exports.send = async (req, res) => {
  // POST
  // /
  let tid;
  if (req.body.threadid == '0') {
    // New chat
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: req.body.input },
    ];
    const response = await chatGPT(messages);
    if (response) {
      messages.push({ role: 'assistant', content: response.choices[0].message.content });
      // Save to database
      const ts = Date.now();
      tid = ts;
      const db_data = [];
      messages.forEach((m, i) => {
        db_data.push({
          user: 'Lennart',
          role: m.role,
          content: m.content,
          tokens: 0,
          timestamp: ts + i,
          threadid: ts,
          title: req.body.title.length > 0 ? req.body.title : `${new Date().toDateString()}`,
        });
      });
      db_data[2].tokens = response.usage.total_tokens;
      await Chatmsg.bulkCreate(db_data);
    } else {
      console.log('Failed to get a response from ChatGPT.');
    }
  } else {
    const data = await Chatmsg.findAll();

    // Continue on previous chat
    const messages = [];
    data.forEach((d) => {
      if (d.threadid == parseInt(req.body.threadid)) {
        messages.push({ role: d.role, content: d.content });
      }
    });
    messages.push({ role: 'user', content: req.body.input });
    const response = await chatGPT(messages);
    if (response) {
      messages.push({ role: 'assistant', content: response.choices[0].message.content });
      // Save to database
      const ts = Date.now();
      tid = parseInt(req.body.threadid);
      const db_data = [];
      for (let i = messages.length - 2; i < messages.length; i++) {
        const m = messages[i];
        db_data.push({
          user: 'Lennart',
          role: m.role,
          content: m.content,
          tokens: 0,
          timestamp: ts + i,
          threadid: tid,
          title: req.body.title.length > 0 ? req.body.title : `${new Date().toDateString()}`,
        });
      }
      db_data[1].tokens = response.usage.total_tokens;
      await Chatmsg.bulkCreate(db_data);
    } else {
      console.log('Failed to get a response from ChatGPT.');
    }
  }

  setTimeout(() => res.redirect(`/chatgpt?tid=${tid}`), 100);
};

/* Chatmsg
role: type.STRING,
content: type.STRING,
tokens: type.INTEGER,
timestamp: type.BIGINT,
threadid: type.BIGINT,
*/
