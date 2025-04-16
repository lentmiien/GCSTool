const pmt = require('../services/DocMgmtService');

exports.top = async (req, res) => {
  const entries = await pmt.fetchEntries();
  res.render("pmt/pmt", {entries});
};