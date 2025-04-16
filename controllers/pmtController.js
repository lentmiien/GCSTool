const marked = require('marked');
const pmt = require('../services/DocMgmtService');

exports.top = async (req, res) => {
  const entries = await pmt.fetchEntries();
  for (let i = 0; i < entries.length; i++) {
    entries[i].html = marked.parse(entries[i].content_md);
  }
  res.render("pmt/pmt", {entries});
};

exports.create = async (req, res) => {
  res.render("pmt/create");
};

exports.savenew = async (req, res) => {
  const id = await pmt.createEntry({
    type: req.body.type,
    title: req.body.title,
    content_md: req.body.content_md,
    category: req.body.category,
    user: req.user.userid,
  });
  res.redirect(`/pmt/edit/${id}`);
};

exports.edit = async (req, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await pmt.fetchEntry(entryId);
  res.render("pmt/edit", {entry});
};

exports.editentry = async (req, res) => {
  console.log(req.body);
  res.redirect(`/pmt`);
};

/* DEBUG TOOLS */
exports.delete_all = async (req, res) => {
  await pmt.ClearDatabase();
  res.redirect("/pmt");
};
