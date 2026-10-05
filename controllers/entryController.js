/****************************
 *
 * Consider
 *
 * change so that an entry can have as many content parts as needed
 * when edit, show the available parts + 1 empty and a button to add more
 *
 */

const { body, validationResult } = require('express-validator');

// Require necessary database models
const { Entry, Content, pmt, sequelize } = require('../sequelize');
const { visibleEntryWhere } = require('../services/legacyContentService');
const marked = require('marked');
const sanitizeHtml = require('../utils/sanitizeHtml');

const CONTENT_LIMIT = 5;

function isAdmin(req) {
  return req.user.role === 'admin';
}

function isGuest(req) {
  return req.user.role === 'guest';
}

function parsePositiveInteger(value) {
  const normalized = String(value || '');
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function bodyString(value) {
  return typeof value === 'string' ? value : '';
}

function canEditEntry(req, entry) {
  if (isGuest(req) || entry.team !== req.user.team) {
    return false;
  }

  return isAdmin(req) || entry.ismaster || entry.creator === req.user.userid;
}

function canDeleteEntry(req, entry) {
  if (isGuest(req) || entry.team !== req.user.team) {
    return false;
  }

  return isAdmin(req) || (!entry.ismaster && entry.creator === req.user.userid);
}

function sortEntryContents(entry) {
  if (entry && Array.isArray(entry.contents)) {
    entry.contents.sort((left, right) => left.id - right.id);
  }
  return entry;
}

function entriesForDisplay(entries) {
  return entries.map((entryInstance) => {
    const entry = entryInstance.get({ plain: true });
    sortEntryContents(entry);
    return entry;
  });
}

function renderForbidden(res, message) {
  return res.status(403).render('error', {
    message: message || 'You do not have permission to modify this entry.',
    error: { status: 403 },
  });
}

async function findVisibleEntry(req, id, options = {}) {
  const query = {
    where: visibleEntryWhere(req, { id }),
  };

  if (options.includeContents) {
    query.include = [{ model: Content }];
  }
  if (options.transaction) {
    query.transaction = options.transaction;
  }
  if (options.lock && options.transaction) {
    query.lock = options.transaction.LOCK.UPDATE;
  }

  const entry = await Entry.findOne(query);
  return sortEntryContents(entry);
}

// Display all Entries
exports.entry_list = async function (req, res, next) {
  try {
    const entries = await Entry.findAll({
      include: [{ model: Content }],
      where: visibleEntryWhere(req),
      order: [
        ['tag', 'ASC'],
        ['category', 'DESC'],
        ['ismaster', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
    });
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 500) : '';

    const libraryEntries = await pmt.PMTEntry.findAll({ order: [['updatedAt', 'DESC']] });
    const sharedEntries = libraryEntries.map(instance => {
      const entry = instance.get({ plain: true });
      return {
        ...entry,
        source: 'pmt',
        detailId: `pmt-entry${entry.id}`,
        category: entry.type.toLowerCase(),
        tag: entry.category,
        ismaster: true,
        contents: [{ data: entry.type === 'Template'
          ? entry.content_md
          : sanitizeHtml(marked.parse(String(entry.content_md || ''))) }],
      };
    });
    const legacyEntries = entriesForDisplay(entries).map(entry => ({ ...entry, detailId: `entry${entry.id}` }));
    res.render('entry', { entries: legacyEntries.concat(sharedEntries), search });
  } catch (error) {
    next(error);
  }
};

// New content is authored in PMT. Old links still lead to the appropriate form.
exports.entry_create_get = function (req, res) {
  return res.redirect('/pmt/create');
};

exports.entry_createcopy_get = function (req, res) {
  const entryId = parsePositiveInteger(req.params.id);
  return res.redirect(entryId ? `/pmt/create?legacy=${entryId}` : '/entry');
};

exports.entry_create_post = function (req, res) {
  return renderForbidden(res, 'New Content entries are disabled. Create entries in the Policy, manual & template library (/pmt/create).');
};

// Display Entry delete form on GET.
exports.entry_delete_get = async function (req, res, next) {
  const entryId = parsePositiveInteger(req.params.id);
  if (!entryId) {
    return res.redirect('/entry');
  }

  try {
    const entry = await findVisibleEntry(req, entryId, { includeContents: true });
    if (!entry) {
      return res.redirect('/entry');
    }
    if (!canDeleteEntry(req, entry)) {
      return renderForbidden(res);
    }

    return res.render('entrydelete', { entry });
  } catch (error) {
    return next(error);
  }
};

// Handle Entry delete on POST.
exports.entry_delete_post = async function (req, res, next) {
  const entryId = parsePositiveInteger(req.params.id);
  if (!entryId) {
    return res.redirect('/entry');
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const entry = await findVisibleEntry(req, entryId, { transaction, lock: true });
      if (!entry) {
        return 'not-found';
      }
      if (isGuest(req)) {
        return 'guest';
      }
      if (!canDeleteEntry(req, entry)) {
        return 'forbidden';
      }

      await Content.destroy({
        where: { entryId: entry.id },
        transaction,
      });
      await entry.destroy({ transaction });
      return 'deleted';
    });

    if (result === 'not-found') {
      return res.redirect('/entry');
    }
    if (result === 'guest') {
      return res.render('entrydeleted', { warning: 'Non-registered users can not remove data...' });
    }
    if (result === 'forbidden') {
      return renderForbidden(res);
    }

    return res.render('entrydeleted', { warning: '' });
  } catch (error) {
    return next(error);
  }
};

// Display Entry update form on GET.
exports.entry_update_get = async function (req, res, next) {
  const entryId = parsePositiveInteger(req.params.id);
  if (!entryId) {
    return res.redirect('/entry');
  }

  try {
    const entry = await findVisibleEntry(req, entryId, { includeContents: true });
    if (!entry) {
      return res.redirect('/entry');
    }
    if (!canEditEntry(req, entry)) {
      return renderForbidden(res);
    }

    return res.render('entryupdate', { entry });
  } catch (error) {
    return next(error);
  }
};

// Handle Entry update on POST.
exports.entry_update_post = [
  // Validation fields
  body('title').isLength({ min: 1, max: 255 }).trim().withMessage('A title is needed.'),

  async (req, res, next) => {
    const entryId = parsePositiveInteger(req.params.id);
    if (!entryId) {
      return res.redirect('/entry');
    }

    try {
      const currentEntry = await findVisibleEntry(req, entryId, { includeContents: true });
      if (!currentEntry) {
        return res.redirect('/entry');
      }
      if (isGuest(req)) {
        return res.render('entryupdated', { warning: 'Non-registered users can not update data...' });
      }
      if (!canEditEntry(req, currentEntry)) {
        return renderForbidden(res);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render('entryupdate', {
          errors: errors.array(),
          entry: currentEntry,
        });
      }

      const result = await sequelize.transaction(async (transaction) => {
        const entry = await findVisibleEntry(req, entryId, { transaction, lock: true });
        if (!entry) {
          return 'not-found';
        }
        if (!canEditEntry(req, entry)) {
          return 'forbidden';
        }

        const existingContents = await Content.findAll({
          where: { entryId: entry.id },
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        await entry.update({
          category: bodyString(req.body.category).slice(0, 255),
          ismaster: isAdmin(req) ? Boolean(req.body.ismaster) : entry.ismaster,
          tag: bodyString(req.body.tag).slice(0, 255),
          title: bodyString(req.body.title),
        }, { transaction });

        for (let contentIndex = 0; contentIndex < CONTENT_LIMIT; contentIndex += 1) {
          const data = bodyString(req.body[`content${contentIndex + 1}`]);
          const existingContent = existingContents[contentIndex];

          if (existingContent && data.length > 0) {
            await Content.update(
              { data },
              {
                where: { id: existingContent.id, entryId: entry.id },
                transaction,
              }
            );
          } else if (existingContent) {
            await Content.destroy({
              where: { id: existingContent.id, entryId: entry.id },
              transaction,
            });
          } else if (data.length > 0) {
            await Content.create({ data, entryId: entry.id }, { transaction });
          }
        }

        // The home-page NEWS query uses the parent entry timestamp, while
        // the editable text is stored in associated Content rows.
        entry.changed('updatedAt', true);
        await entry.save({ fields: ['updatedAt'], transaction });

        return 'updated';
      });

      if (result === 'not-found') {
        return res.redirect('/entry');
      }
      if (result === 'forbidden') {
        return renderForbidden(res);
      }

      return res.render('entryupdated', { warning: '' });
    } catch (error) {
      return next(error);
    }
  },
];

// Backup
exports.backup = async function (req, res, next) {
  if (req.params.team !== req.user.team) {
    return renderForbidden(res, 'You do not have permission to back up entries for this team.');
  }

  try {
    const entries = await Entry.findAll({
      include: [{ model: Content }],
      where: visibleEntryWhere(req),
      order: [
        ['tag', 'ASC'],
        ['category', 'DESC'],
        ['ismaster', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
    });

    return res.render('backup', { data: JSON.stringify(entries) });
  } catch (error) {
    return next(error);
  }
};

// Restoring a backup would create new legacy entries as well.
exports.restore = exports.entry_create_post;
