const { Entry, Content, Op } = require('../sequelize');
const parseSearchTerms = require('../utils/parseSearchTerms');

function visibleEntryWhere(req, extraWhere) {
  const where = { team: req.user.team, ...extraWhere };
  if (req.user.role !== 'admin') {
    where[Op.or] = [{ ismaster: true }, { creator: req.user.userid }];
  }
  return where;
}

function normalizeEntry(instance) {
  const entry = instance.get({ plain: true });
  const contents = (entry.contents || []).slice().sort((left, right) => left.id - right.id);
  return {
    ...entry,
    source: 'legacy',
    type: entry.category === 'manual' ? 'Manual' : 'Template',
    category: entry.tag,
    contents,
  };
}

async function fetchEntries(req, { type, category, search = '' } = {}) {
  const terms = parseSearchTerms(search).map(term => term.toLowerCase());
  const entries = await Entry.findAll({
    where: visibleEntryWhere(req, category ? { tag: category } : {}),
    include: [{ model: Content }],
    order: [['updatedAt', 'DESC']],
  });
  return entries.map(normalizeEntry).filter(entry => {
    if (type && entry.type !== type) return false;
    const fields = [entry.title, ...entry.contents.map(content => content.data)]
      .map(value => String(value || '').toLowerCase());
    return terms.every(term => fields.some(field => field.includes(term)));
  });
}

async function fetchEntry(req, id) {
  const entry = await Entry.findOne({
    where: visibleEntryWhere(req, { id }),
    include: [{ model: Content }],
  });
  if (!entry) {
    const error = new Error('Entry not found');
    error.status = 404;
    throw error;
  }
  return normalizeEntry(entry);
}

module.exports = { visibleEntryWhere, fetchEntries, fetchEntry };
