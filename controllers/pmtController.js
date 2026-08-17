const marked = require('marked');
const pmt = require('../services/DocMgmtService');
const sanitizeHtml = require('../utils/sanitizeHtml');

const PMT_TYPES = new Set(['Policy', 'Manual', 'Template']);
const PMT_CATEGORIES = new Set([
  '_account_related_', '_order_item_statuses_', '_order_modifying_', '_payment_shipping_',
  '_after_service_shipping_', '_after_service_defect_', '_after_service_preowned_',
  '_returns_refunds_', '_claims_cases_', '_work_related_', '_case_assist_',
  '_customer_dep_', '_logistics_dep_', '_feedback_', '_other_',
]);

function asyncHandler(handler) {
  return function handleAsyncRequest(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (error && error.message === 'Entry not found' && !error.status) {
        error.status = 404;
      }
      next(error);
    });
  };
}

function parsePositiveId(value, fieldName) {
  const normalized = String(value || '');
  if (!/^[1-9]\d*$/.test(normalized)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.status = 400;
    throw error;
  }
  const id = Number(normalized);
  if (!Number.isSafeInteger(id)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.status = 400;
    throw error;
  }
  return id;
}

function requireText(value, fieldName, maxLength, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0) || value.length > maxLength) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.status = 400;
    throw error;
  }
  return value;
}

function requireChoice(value, allowedValues, fieldName) {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.status = 400;
    throw error;
  }
  return value;
}

function parseParentIds(value) {
  const values = [].concat(value || []).slice(0, 100);
  return Array.from(new Set(values.map((id) => parsePositiveId(id, 'parent policy ID'))));
}

async function validateParentIds(parentIds, policies) {
  if (parentIds.length === 0) {
    return;
  }
  const availablePolicies = policies || await pmt.fetchPolicies();
  const validIds = new Set(availablePolicies.map((policy) => Number(policy.id)));
  if (parentIds.some((parentId) => !validIds.has(parentId))) {
    const error = new Error('One or more parent policies do not exist.');
    error.status = 400;
    throw error;
  }
}

function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(String(markdown || '')));
}

exports.top = asyncHandler(async (req, res) => {
  const type = PMT_TYPES.has(req.query.type) ? req.query.type : null;
  const category = PMT_CATEGORIES.has(req.query.category) ? req.query.category : null;
  const entries = await pmt.fetchEntries({ type, category });
  entries.forEach((entry) => {
    entry.html = renderMarkdown(entry.content_md);
  });
  const logs = await pmt.fetchAllLogs({ action: 'flagged-for-review' });
  res.render('pmt/pmt', {
    entries,
    query: { type: type || '', category: category || '' },
    reviews: logs.length,
  });
});

exports.create = asyncHandler(async (req, res) => {
  const policies = await pmt.fetchPolicies();
  const selected = [];
  if (req.query.parent) {
    const parentId = parsePositiveId(req.query.parent, 'parent policy ID');
    await validateParentIds([parentId], policies);
    selected.push(parentId);
  }
  res.render('pmt/create', { query: req.query, policies, selected });
});

exports.savenew = asyncHandler(async (req, res) => {
  const type = requireChoice(req.body.type, PMT_TYPES, 'entry type');
  const title = requireText(req.body.title, 'title', 255);
  const contentMarkdown = requireText(req.body.content_md, 'content', 1000000, true);
  const category = requireChoice(req.body.category, PMT_CATEGORIES, 'category');
  const parentIds = parseParentIds(req.body.policyIds);
  await validateParentIds(parentIds);
  const id = await pmt.createEntry({
    type,
    title,
    content_md: contentMarkdown,
    category,
    user: req.user.userid,
  });
  if (parentIds.length > 0) {
    await pmt.replaceParents({
      entryId: id,
      parentIds,
      user: req.user.userid,
    });
  }
  res.redirect(`/pmt/details/${id}`);
});

exports.details = asyncHandler(async (req, res) => {
  const entryId = parsePositiveId(req.params.id, 'entry ID');
  const entry = await pmt.fetchEntry(entryId);
  entry.entry.html = renderMarkdown(entry.entry.content_md);
  entry.versions.forEach((version) => {
    version.html = renderMarkdown(version.content_md);
  });
  const entryMap = {};
  for (const relatedEntry of entry.parentEntries.concat(entry.childEntries)) {
    entryMap[relatedEntry.id] = {
      title: relatedEntry.title,
      html: renderMarkdown(relatedEntry.content_md),
    };
  }
  entry.parents = entry.parents.filter((parent) => entryMap[parent.parent_id]);
  entry.children = entry.children.filter((child) => entryMap[child.child_id]);
  res.render('pmt/details', { entry, entryMap });
});

exports.edit = asyncHandler(async (req, res) => {
  const entryId = parsePositiveId(req.params.id, 'entry ID');
  const entry = await pmt.fetchEntry(entryId);
  const policies = await pmt.fetchPolicies();
  const selected = (await pmt.fetchParentDependencies(entryId)).map((parent) => parent.parent_id);
  res.render('pmt/edit', { entry, policies, selected });
});

exports.editentry = asyncHandler(async (req, res) => {
  const entryId = parsePositiveId(req.params.id, 'entry ID');
  const title = requireText(req.body.title, 'title', 255);
  const contentMarkdown = requireText(req.body.content_md, 'content', 1000000, true);
  const parentIds = parseParentIds(req.body.policyIds).filter((parentId) => parentId !== entryId);
  await validateParentIds(parentIds);
  await pmt.updateEntry({
    entryId,
    title,
    newContentMarkdown: contentMarkdown,
    user: req.user.userid,
  });
  await pmt.replaceParents({
    entryId,
    parentIds,
    user: req.user.userid,
  });
  res.redirect(`/pmt/details/${entryId}`);
});

exports.logs = asyncHandler(async (_req, res) => {
  const logs = await pmt.fetchAllLogs();
  res.render('pmt/logs', { logs });
});

exports.reviews = asyncHandler(async (_req, res) => {
  const logs = await pmt.fetchAllLogs({ action: 'flagged-for-review' });
  res.render('pmt/reviews', { logs });
});

exports.complete = asyncHandler(async (req, res) => {
  const logId = parsePositiveId(req.params.id, 'review ID');
  const completed = await pmt.markReviewCompleted({ logId, user: req.user.userid });
  if (!completed) {
    const error = new Error('Review item not found.');
    error.status = 404;
    throw error;
  }
  res.redirect('/pmt/reviews');
});
