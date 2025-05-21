const marked = require('marked');
const pmt = require('../services/DocMgmtService');

exports.top = async (req, res) => {
  const { type, category } = req.query;
  const entries = await pmt.fetchEntries({ type, category });
  entries.forEach(e => (e.html = marked.parse(e.content_md)));
  const logs = await pmt.fetchAllLogs({ action: 'flagged-for-review' });
  res.render('pmt/pmt', { entries, query: req.query, reviews: logs.length });
};

exports.create = async (req, res) => {
  const policies = await pmt.fetchPolicies();
  const selected = [];
  if (req.query.parent) selected.push(parseInt(req.query.parent));
  res.render("pmt/create", {query: req.query, policies, selected});
};

exports.savenew = async (req, res) => {
  const id = await pmt.createEntry({
    type: req.body.type,
    title: req.body.title,
    content_md: req.body.content_md,
    category: req.body.category,
    user: req.user.userid,
  });
  const newParentIds = []
    .concat(req.body.policyIds || [])              // could be string or array
    .map(x=>parseInt(x))
    .filter(Boolean);
  if (newParentIds.length > 0) {
    await pmt.replaceParents({
      entryId: id,
      parentIds: newParentIds,
      user: req.user.userid,
    });
  }
  res.redirect(`/pmt/details/${id}`);
};

exports.details = async (req, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await pmt.fetchEntry(entryId);
  entry.entry.html = marked.parse(entry.entry.content_md);
  for (let i = 0; i < entry.versions.length; i++) {
    entry.versions[i].html = marked.parse(entry.versions[i].content_md);
  }
  const entryMap = {};
  for (const e of entry.parentEntries) {
    entryMap[e.id] = {
      title: e.title,
      html: marked.parse(e.content_md),
    };
  }
  for (const e of entry.childEntries) {
    entryMap[e.id] = {
      title: e.title,
      html: marked.parse(e.content_md),
    };
  }
  res.render("pmt/details", {entry, entryMap});
};

exports.edit = async (req, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await pmt.fetchEntry(entryId);
  const policies = await pmt.fetchPolicies();
  const selected = (await pmt.fetchParentDependencies(entryId)).map(p => p.parent_id);
  res.render("pmt/edit", { entry, policies, selected });
};

exports.editentry = async (req, res) => {
  const entryId = parseInt(req.params.id);
  await pmt.updateEntry({
    entryId: entryId,
    title: req.body.title,
    newContentMarkdown: req.body.content_md,
    user: req.user.userid,
  });
  const newParentIds = []
    .concat(req.body.policyIds || [])              // could be string or array
    .map(x=>parseInt(x))
    .filter(Boolean);
  await pmt.replaceParents({
    entryId,
    parentIds: newParentIds,
    user: req.user.userid,
  });
  res.redirect(`/pmt/details/${entryId}`);
};

exports.logs = async (req, res) => {
  const logs = await pmt.fetchAllLogs();
  res.render('pmt/logs', { logs });
};

exports.reviews = async (req, res) => {
  const logs = await pmt.fetchAllLogs({ action: 'flagged-for-review' });
  res.render('pmt/reviews', { logs });
};

exports.complete = async (req, res) => {
  const logId = parseInt(req.params.id);
  await pmt.markReviewCompleted({ logId, user: req.user.userid });
  res.redirect('back');
};

/* DEBUG TOOLS */
exports.delete_all = async (req, res) => {
  await pmt.ClearDatabase();
  res.redirect("/pmt");
};
