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
  res.redirect(`/pmt/details/${id}`);
};

exports.details = async (req, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await pmt.fetchEntry(entryId);
  entry.entry.html = marked.parse(entry.entry.content_md);
  for (let i = 0; i < entry.versions.length; i++) {
    entry.versions[i].html = marked.parse(entry.versions[i].content_md);
  }
  res.render("pmt/details", {entry});
};

exports.edit = async (req, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await pmt.fetchEntry(entryId);
  res.render("pmt/edit", {entry});
};

exports.editentry = async (req, res) => {
  const entryId = parseInt(req.params.id);
  await pmt.updateEntry({
    entryId: entryId,
    title: req.body.title,
    newContentMarkdown: req.body.content_md,
    user: req.user.userid,
  });
  res.redirect(`/pmt/details/${entryId}`);
};

/* DEBUG TOOLS */
exports.delete_all = async (req, res) => {
  await pmt.ClearDatabase();
  res.redirect("/pmt");
};
