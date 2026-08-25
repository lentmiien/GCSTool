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
const { Entry, Content, Op, sequelize } = require('../sequelize');

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

function visibleEntryWhere(req, extraWhere) {
  const where = {
    team: req.user.team,
    ...extraWhere,
  };

  if (!isAdmin(req)) {
    where[Op.or] = [
      { ismaster: true },
      { creator: req.user.userid },
    ];
  }

  return where;
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

    res.render('entry', { entries: entriesForDisplay(entries), search });
  } catch (error) {
    next(error);
  }
};

// Display Entry create form on GET
exports.entry_create_get = function (req, res) {
  res.render('entryadd', { request: {} });
};

// Copy entry
exports.entry_createcopy_get = async function (req, res, next) {
  const entryId = parsePositiveInteger(req.params.id);
  if (!entryId) {
    return res.redirect('/entry');
  }

  try {
    const entry = await findVisibleEntry(req, entryId, { includeContents: true });
    if (!entry) {
      return res.redirect('/entry');
    }

    const request = {
      category: entry.category,
      ismaster: isAdmin(req) && entry.ismaster ? 1 : 0,
      tag: entry.tag,
      team: req.user.team,
      title: entry.title,
    };
    entry.contents.slice(0, CONTENT_LIMIT).forEach((content, index) => {
      request[`content${index + 1}`] = content.data;
    });

    return res.render('entryadd', { request });
  } catch (error) {
    return next(error);
  }
};

// Handle Entry create on POST.
exports.entry_create_post = [
  // Validation fields
  body('title').isLength({ min: 1, max: 255 }).trim().withMessage('A title is needed.'),
  body('content1').isLength({ min: 1 }).trim().withMessage('Content 1 is needed.'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).render('entryadd', { errors: errors.array(), request: req.body });
    }

    if (isGuest(req)) {
      return res.render('entryadded', { warning: 'Non-registered users can not add data...' });
    }

    const wantsMaster = Boolean(req.body.ismaster);
    const inputData = {
      creator: req.user.userid,
      category: bodyString(req.body.category).slice(0, 255),
      ismaster: isAdmin(req) && wantsMaster,
      tag: bodyString(req.body.tag).slice(0, 255),
      team: req.user.team,
      title: bodyString(req.body.title),
      contents: [],
    };

    for (let contentIndex = 1; contentIndex <= CONTENT_LIMIT; contentIndex += 1) {
      const data = bodyString(req.body[`content${contentIndex}`]);
      if (data.length > 0) {
        inputData.contents.push({ data });
      }
    }

    const warning = wantsMaster && !isAdmin(req)
      ? 'You can not add master data, added as personal data instead.'
      : '';

    try {
      await Entry.create(inputData, { include: Entry.Content });
      return res.render('entryadded', { warning });
    } catch (error) {
      return next(error);
    }
  },
];

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

// Handle Entry restore on POST.
exports.restore = async function (req, res, next) {
  if (!isAdmin(req)) {
    return res.redirect('/');
  }

  let data;
  try {
    data = JSON.parse(bodyString(req.body.restore));
  } catch (error) {
    return res.status(400).render('error', {
      message: 'The backup data is not valid JSON.',
      error: { status: 400 },
    });
  }

  if (!Array.isArray(data)) {
    return res.status(400).render('error', {
      message: 'The backup data must contain a list of entries.',
      error: { status: 400 },
    });
  }

  const inputData = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return res.status(400).render('error', {
        message: 'The backup contains an invalid entry.',
        error: { status: 400 },
      });
    }

    const contents = Array.isArray(entry.contents)
      ? entry.contents.slice(0, CONTENT_LIMIT)
        .filter((content) => content && typeof content.data === 'string')
        .map((content) => ({ data: content.data }))
      : [];

    inputData.push({
      creator: req.user.userid,
      category: bodyString(entry.category).slice(0, 255),
      ismaster: entry.ismaster === true || entry.ismaster === 1 || entry.ismaster === '1',
      tag: bodyString(entry.tag).slice(0, 255),
      team: req.user.team,
      title: bodyString(entry.title).slice(0, 255),
      contents,
    });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await Entry.bulkCreate(inputData, { include: Entry.Content, transaction });
    });
    return res.redirect('/');
  } catch (error) {
    return next(error);
  }
};
