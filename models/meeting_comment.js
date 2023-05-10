module.exports = (sequelize, type) => {
  return sequelize.define('meeting_comment', {
    meeting_id: type.NUMBER,
    created_by: type.STRING,
    content: type.TEXT,
  });
};
