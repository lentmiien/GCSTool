module.exports = (sequelize, type) => {
  return sequelize.define('chatmsg', {
    user: type.STRING,
    role: type.STRING,
    content: type.TEXT,
    tokens: type.INTEGER,
    timestamp: type.BIGINT,
    threadid: type.BIGINT,
    title: type.STRING,
    // model: type.STRING(100),// TODO: uncomment when ready
  });
};
