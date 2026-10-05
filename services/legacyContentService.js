const { Entry, Content, Op } = require('../sequelize');

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

async function fetchEntries(req, { type, category } = {}) {
  const entries = await Entry.findAll({
    where: visibleEntryWhere(req, category ? { tag: category } : {}),
    include: [{ model: Content }],
    order: [['updatedAt', 'DESC']],
  });
  return entries.map(normalizeEntry).filter(entry => !type || entry.type === type);
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
