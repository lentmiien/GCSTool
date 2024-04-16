const { chatGPT, embedding } = require('../utils/ChatGPT');
const { Chatmsg } = require('../sequelize');

// Monthly token limit 2500000 = $5
// I'm setting this limit as it's a trial
const MONTHLY_TOKEN_LIMIT = 2500000;

function insertCharAt(str, index, char) {
  if (index > str.length) {
    return str;
  }

  let firstPart = str.slice(0, index);
  let secondPart = str.slice(index);
  return firstPart + char + secondPart;
}

async function ExceededMonthlyTokenLimit() {
  const data = await Chatmsg.findAll();
  const date = new Date();
  let tokens = 0;
  data.forEach((d) => {
    const entry_date = new Date(d.timestamp);
    if (date.getFullYear() == entry_date.getFullYear() && date.getMonth() == entry_date.getMonth()) {
      tokens += d.tokens;
    }
  });

  return tokens > MONTHLY_TOKEN_LIMIT;
}

const OpenAI_Prices = {
  'gpt-3.5-turbo': {
    'user': 0.0015,
    'assistant': 0.002,
    'system': 0,
  },
  'gpt-3.5-turbo-16k': {
    'user': 0.003,
    'assistant': 0.004,
    'system': 0,
  },
  'text-embedding-ada-002': {
    'user': 0.0001,
    'assistant': 0.0001,
    'system': 0.0001,
  }
};

//gpt-3.5-turbo or gpt-3.5-turbo-16k
exports.index = async (req, res) => {
  // GET
  // /
  const data = await Chatmsg.findAll();
  const display = {};
  const keys = [];
  const costs = [];
  const costs_lookup = [];
  const button_list = [];

  // Generate chats, button list and calculate monthly costs
  data.forEach((d) => {
    if (d.threadid in display) {
      display[d.threadid].push(d);

      const index = keys.indexOf(d.threadid);
      button_list[index].title = d.title;
      button_list[index].tokens += d.tokens;
      button_list[index].timestamp = d.timestamp;
    } else {
      display[d.threadid] = [];
      display[d.threadid].push(d);
      keys.push(d.threadid);

      button_list.push({
        title: d.title,
        tokens: d.tokens,
        timestamp: d.timestamp,
        threadid: d.threadid,
      });
    }

    const date = new Date(d.timestamp);
    const dkey = date.getFullYear() * 100 + date.getMonth() + 1;
    const dlabel = insertCharAt(dkey.toString(), 4, '-');
    const index = costs_lookup.indexOf(dlabel);
    if (index == -1) {
      costs_lookup.push(dlabel);
      costs.push({
        dkey,
        dlabel,
        tokens: d.tokens,
        cost: (0.002 * d.tokens) / 1000,
        // cost: (OpenAI_Prices[d.model][d.role] * d.tokens) / 1000,
      });
    } else {
      costs[index].tokens += d.tokens;
      costs[index].cost = (0.002 * costs[index].tokens) / 1000;
      // costs[index].cost = (OpenAI_Prices[d.model][d.role] * costs[index].tokens) / 1000;
    }
  });

  // Sort chat messages
  keys.forEach((key) => {
    display[key].sort((a, b) => {
      if (a.timestamp < b.timestamp) return -1;
      if (a.timestamp > b.timestamp) return 1;
      return 0;
    });
  });

  // sort button list, last updated at top
  button_list.sort((a, b) => {
    if (a.timestamp > b.timestamp) return -1;
    if (a.timestamp < b.timestamp) return 1;
    return 0;
  });

  res.render('chatgpt', { display, keys, chat: req.query.tid ? req.query.tid : '0', costs, button_list });
};

exports.send = async (req, res) => {
  // Check monthly token limit before doing anything else
  const exceeded = await ExceededMonthlyTokenLimit();
  if (exceeded) {
    res.send('<h1>Exceeded monthly token limit, please wait until next month before using ChatGPT again!</h1>');
  } else {
    // POST
    // /
    let model_to_use = 'gpt-3.5-turbo';
    let tid;
    if (req.body.threadid == '0') {
      // New chat
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: req.body.input },
      ];
      const response = await chatGPT(messages, model_to_use);
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
      const response = await chatGPT(messages, model_to_use);
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
  }
};

exports.generate = async (req, res) => {
  // Check monthly token limit before doing anything else
  const exceeded = await ExceededMonthlyTokenLimit();
  if (exceeded) {
    res.json({ text: 'Exceeded monthly token limit, please wait until next month before using ChatGPT again!' });
  } else {
    // input: text in body
    let output = req.body.text;
    const title = req.body.title;

    let model_to_use = 'gpt-3.5-turbo';

    // New chat
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: req.body.text },
    ];
    const response = await chatGPT(messages, model_to_use);
    if (response) {
      output = response.choices[0].message.content;
      messages.push({ role: 'assistant', content: response.choices[0].message.content });
      // Save to database
      const ts = Date.now();
      const db_data = [];
      messages.forEach((m, i) => {
        db_data.push({
          user: req.user.userid,
          role: m.role,
          content: m.content,
          tokens: 0,
          timestamp: ts + i,
          threadid: ts,
          title: `AI [${title}]`,
        });
      });
      db_data[2].tokens = response.usage.total_tokens;
      await Chatmsg.bulkCreate(db_data);
    } else {
      console.log('Failed to get a response from ChatGPT.');
    }

    // output: text in json
    res.json({ text: output });
  }
};

/**
 * GET
 * url: /chatgpt/language_tools
 * Display a page where the user can select a CSV file from their computer,
 * then select the type of process (merchandise names, translations)
 * then specify input/output columns *one empty column at end will be default output
 * lastly specify options and send to server
 * 
 * Send to server
 * - prepare a context message for the particular request and append to messages array
 * - itterate over the rows in the CSV data, and send in batches of 25 lines to the server
 *   - prepare message for the 25 lines and append to messages array
 * - when response is recived, parse the data for the required information
 * - display output and repeat until done
 * Note: the context or message should request for response in JSON format
 */
exports.language_tools = (req, res) => {
  res.render('language_tools');
};

/**
 * POST
 * url: /chatgpt/language_tools/send
 * Input is array of messages in ChatGPT format (prepared on user side), and a thread_id if available
 * 
 * Output is the same array of messages, with response appended, and thread_id (generate and return new if not provided)
 * 
 * Array structure:
 * {
 *   title: A title for the conversation
 *   thread_id: ID for this conversation,
 *   messages: [
 *     { role: 'system' or 'user' or 'assistant', content: Prompt or response },
 *     {},
 *     ...
 *   ]
 * }
 */
exports.language_send = async (req, res) => {
  const tid = req.body.thread_id != 0 ? req.body.thread_id : Date.now();
  const ts = Date.now();
  const db_data = [];
  const messages = req.body.messages;

  const response = await chatGPT(messages);
  if (response) {
    messages.push({ role: 'assistant', content: response.choices[0].message.content });
    // Save to database
    for (let i = req.body.thread_id != 0 ? messages.length - 2 : 0; i < messages.length; i++) {
      const m = messages[i];
      db_data.push({
        user: 'Lennart',
        role: m.role,
        content: m.content,
        tokens: 0,
        timestamp: ts + i,
        threadid: tid,
        title: req.body.title && req.body.title.length > 0 ? req.body.title : `${new Date().toDateString()}`,
      });
    }
    db_data[db_data.length - 2].tokens = response.usage.prompt_tokens;
    db_data[db_data.length - 1].tokens = response.usage.completion_tokens;
    await Chatmsg.bulkCreate(db_data);
  }

  res.json({thread_id: tid, messages})
};
