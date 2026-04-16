const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dhlCompensation, Op } = require('../sequelize');

const DHLCompensationEntry = dhlCompensation.Entry;
const PDF_FIELD_NAME = 'pdf_file';
const PDF_SIGNATURE = '%PDF-';
const PDF_STORAGE_DIR = path.join(__dirname, '..', 'data', 'dhl_compensation_pdfs');

function setLayoutLocals(req, res) {
  res.locals.role = req.user && req.user.role ? req.user.role : 'guest';
  res.locals.name = req.user && req.user.userid ? req.user.userid : 'Guest';
}

function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

function pad2(value) {
  return value > 9 ? value.toString() : `0${value}`;
}

function getCurrentUser(req) {
  return req.user && req.user.userid ? req.user.userid : 'Unknown';
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatAmount(value) {
  return new Intl.NumberFormat('ja-JP').format(value || 0);
}

function toDateOnly(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateOnly(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function parsePositiveInteger(value) {
  const normalized = typeof value === 'string' ? value.trim().replace(/,/g, '') : '';

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = parseInt(normalized, 10);
  return parsed > 0 ? parsed : null;
}

function sanitizePdfFileName(value) {
  const baseName = path.basename(typeof value === 'string' ? value : '');
  const sanitized = baseName.replace(/[\r\n"]/g, '').trim();

  if (!sanitized) {
    return 'document.pdf';
  }

  return path.extname(sanitized).toLowerCase() === '.pdf' ? sanitized : `${sanitized}.pdf`;
}

function getUploadedPdf(req) {
  if (!req.files || !Object.prototype.hasOwnProperty.call(req.files, PDF_FIELD_NAME)) {
    return null;
  }

  return req.files[PDF_FIELD_NAME];
}

function validatePdfUpload(upload) {
  if (!upload) {
    return null;
  }

  if (Array.isArray(upload)) {
    return 'Please upload only one PDF file per entry.';
  }

  if (!Buffer.isBuffer(upload.data) || upload.data.length === 0) {
    return 'The uploaded PDF file is empty.';
  }

  if (upload.data.slice(0, PDF_SIGNATURE.length).toString('ascii') !== PDF_SIGNATURE) {
    return 'Please upload a valid PDF file.';
  }

  return null;
}

function createPdfStorageName() {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.pdf`;
}

function getPdfFilePath(storageName) {
  return path.join(PDF_STORAGE_DIR, storageName);
}

async function saveUploadedPdf(upload) {
  const storageName = createPdfStorageName();

  await fs.promises.mkdir(PDF_STORAGE_DIR, { recursive: true });
  await fs.promises.writeFile(getPdfFilePath(storageName), upload.data);

  return {
    pdf_original_name: sanitizePdfFileName(upload.name),
    pdf_storage_name: storageName,
  };
}

async function deleteStoredPdf(storageName) {
  if (!storageName) {
    return;
  }

  try {
    await fs.promises.unlink(getPdfFilePath(storageName));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function deletePdfForEntry(entry) {
  if (!entry || !entry.pdf_storage_name) {
    return;
  }

  await deleteStoredPdf(entry.pdf_storage_name);
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey;
  }

  const [year, month] = monthKey.split('-').map((part) => parseInt(part, 10));
  const monthLabels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return `${monthLabels[month - 1]} ${year}`;
}

function mapEntry(entry) {
  const data = entry.get({ plain: true });

  return {
    ...data,
    has_pdf: Boolean(data.pdf_storage_name && data.pdf_original_name),
    amount_label: formatAmount(data.compensation_amount_jpy),
    created_at_label: formatTimestamp(data.createdAt),
    updated_at_label: formatTimestamp(data.updatedAt),
  };
}

function compareOpenEntries(left, right) {
  if (left.expected_transaction_date && right.expected_transaction_date) {
    if (left.expected_transaction_date !== right.expected_transaction_date) {
      return left.expected_transaction_date.localeCompare(right.expected_transaction_date);
    }
  } else if (left.expected_transaction_date) {
    return -1;
  } else if (right.expected_transaction_date) {
    return 1;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function buildCompletedGroups(entries) {
  const groups = [];
  const lookup = {};

  entries.forEach((entry) => {
    const monthKey = entry.transaction_date ? entry.transaction_date.slice(0, 7) : 'unknown';

    if (!lookup[monthKey]) {
      lookup[monthKey] = {
        key: monthKey,
        label: formatMonthLabel(monthKey),
        entry_count: 0,
        total_amount_jpy: 0,
        total_amount_label: '0',
        entries: [],
      };
      groups.push(lookup[monthKey]);
    }

    lookup[monthKey].entries.push(entry);
    lookup[monthKey].entry_count += 1;
    lookup[monthKey].total_amount_jpy += entry.compensation_amount_jpy;
    lookup[monthKey].total_amount_label = formatAmount(lookup[monthKey].total_amount_jpy);
  });

  return groups;
}

function getCompletedCutoffDate() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - 23);
  return cutoff;
}

function getNewEntryDraft(body) {
  return {
    order_number: body && body.order_number ? body.order_number : '',
    tracking_number: body && body.tracking_number ? body.tracking_number : '',
    compensation_amount_jpy: body && body.compensation_amount_jpy ? body.compensation_amount_jpy : '',
  };
}

async function buildViewModel(options = {}) {
  const cutoffDate = toDateOnly(getCompletedCutoffDate());

  const [openEntriesRaw, completedEntriesRaw] = await Promise.all([
    DHLCompensationEntry.findAll({
      where: {
        completed: false,
      },
      order: [
        ['expected_transaction_date', 'ASC'],
        ['createdAt', 'DESC'],
      ],
    }),
    DHLCompensationEntry.findAll({
      where: {
        completed: true,
        transaction_date: {
          [Op.gte]: cutoffDate,
        },
      },
      order: [
        ['transaction_date', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
    }),
  ]);

  const openEntries = openEntriesRaw.map(mapEntry).sort(compareOpenEntries);
  const completedEntries = completedEntriesRaw.map(mapEntry);

  return {
    message: options.message || null,
    error: options.error || null,
    newEntry: getNewEntryDraft(options.newEntry),
    openEntries,
    openCount: openEntries.length,
    completedGroups: buildCompletedGroups(completedEntries),
    completedCount: completedEntries.length,
    completedCutoff: cutoffDate,
  };
}

async function renderIndex(req, res, options = {}, statusCode = 200) {
  const viewModel = await buildViewModel(options);
  res.status(statusCode).render('dhl_compensation/index', viewModel);
}

exports.all = (req, res, next) => {
  setLayoutLocals(req, res);

  if (!isAdmin(req)) {
    return res.status(403).render('error', {
      message: 'Admin access required.',
      request: req.body,
      error: { status: 403 },
    });
  }

  next();
};

exports.index = async (req, res, next) => {
  try {
    await renderIndex(req, res, {
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  let storedPdf = null;

  try {
    const orderNumber = typeof req.body.order_number === 'string' ? req.body.order_number.trim() : '';
    const trackingNumber = typeof req.body.tracking_number === 'string' ? req.body.tracking_number.trim() : '';
    const compensationAmount = parsePositiveInteger(req.body.compensation_amount_jpy);
    const pdfUpload = getUploadedPdf(req);
    const pdfValidationError = validatePdfUpload(pdfUpload);

    if (!orderNumber || !trackingNumber || compensationAmount === null) {
      return await renderIndex(req, res, {
        error: 'Order number, tracking number, and a positive compensation amount are required.',
        newEntry: getNewEntryDraft(req.body),
      }, 400);
    }

    if (pdfValidationError) {
      return await renderIndex(req, res, {
        error: pdfValidationError,
        newEntry: getNewEntryDraft(req.body),
      }, 400);
    }

    if (pdfUpload) {
      try {
        storedPdf = await saveUploadedPdf(pdfUpload);
      } catch (error) {
        console.error('Failed to save DHL compensation PDF:', error);
        return await renderIndex(req, res, {
          error: 'Failed to save the uploaded PDF file. Please try again.',
          newEntry: getNewEntryDraft(req.body),
        }, 500);
      }
    }

    const user = getCurrentUser(req);
    try {
      await DHLCompensationEntry.create({
        order_number: orderNumber,
        tracking_number: trackingNumber,
        compensation_amount_jpy: compensationAmount,
        pdf_original_name: storedPdf ? storedPdf.pdf_original_name : null,
        pdf_storage_name: storedPdf ? storedPdf.pdf_storage_name : null,
        created_by: user,
        updated_by: user,
      });
    } catch (error) {
      if (storedPdf) {
        try {
          await deleteStoredPdf(storedPdf.pdf_storage_name);
        } catch (cleanupError) {
          console.error('Failed to clean up stored DHL compensation PDF after DB error:', cleanupError);
        }
      }

      throw error;
    }

    res.redirect('/dhl-compensation?message=' + encodeURIComponent('DHL compensation entry created.'));
  } catch (error) {
    next(error);
  }
};

exports.downloadPdf = async (req, res, next) => {
  try {
    const entryId = parseInt(req.params.id, 10);

    if (!Number.isInteger(entryId)) {
      return await renderIndex(req, res, { error: 'Invalid entry id.' }, 400);
    }

    const entry = await DHLCompensationEntry.findOne({
      where: {
        id: entryId,
        completed: false,
      },
    });

    if (!entry) {
      return await renderIndex(req, res, { error: 'Open DHL compensation entry not found.' }, 404);
    }

    if (!entry.pdf_storage_name || !entry.pdf_original_name) {
      return await renderIndex(req, res, { error: 'No PDF file is attached to this entry.' }, 404);
    }

    const pdfPath = getPdfFilePath(entry.pdf_storage_name);

    try {
      await fs.promises.access(pdfPath, fs.constants.F_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return await renderIndex(req, res, { error: 'Uploaded PDF file not found.' }, 404);
      }

      throw error;
    }

    res.download(pdfPath, entry.pdf_original_name);
  } catch (error) {
    next(error);
  }
};

exports.setEstimatedDate = async (req, res, next) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const expectedTransactionDate = parseDateOnly(req.body.expected_transaction_date);

    if (!Number.isInteger(entryId)) {
      return await renderIndex(req, res, { error: 'Invalid entry id.' }, 400);
    }

    if (!expectedTransactionDate) {
      return await renderIndex(req, res, { error: 'Please enter a valid estimated transaction date.' }, 400);
    }

    const entry = await DHLCompensationEntry.findOne({
      where: {
        id: entryId,
        completed: false,
      },
    });

    if (!entry) {
      return await renderIndex(req, res, { error: 'Open DHL compensation entry not found.' }, 404);
    }

    await entry.update({
      expected_transaction_date: expectedTransactionDate,
      updated_by: getCurrentUser(req),
    });

    res.redirect('/dhl-compensation?message=' + encodeURIComponent('Estimated transaction date updated.'));
  } catch (error) {
    next(error);
  }
};

exports.complete = async (req, res, next) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const transactionDate = parseDateOnly(req.body.transaction_date);

    if (!Number.isInteger(entryId)) {
      return await renderIndex(req, res, { error: 'Invalid entry id.' }, 400);
    }

    if (!transactionDate) {
      return await renderIndex(req, res, { error: 'Please enter a valid transaction date before marking the entry as completed.' }, 400);
    }

    const entry = await DHLCompensationEntry.findOne({
      where: {
        id: entryId,
        completed: false,
      },
    });

    if (!entry) {
      return await renderIndex(req, res, { error: 'Open DHL compensation entry not found.' }, 404);
    }

    try {
      await deletePdfForEntry(entry);
    } catch (error) {
      console.error('Failed to delete DHL compensation PDF during completion:', error);
      return await renderIndex(req, res, {
        error: 'Failed to delete the uploaded PDF file. The entry was not marked as completed.',
      }, 500);
    }

    await entry.update({
      transaction_date: transactionDate,
      completed: true,
      pdf_original_name: null,
      pdf_storage_name: null,
      updated_by: getCurrentUser(req),
    });

    res.redirect('/dhl-compensation?message=' + encodeURIComponent('Entry marked as completed.'));
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const entryId = parseInt(req.params.id, 10);

    if (!Number.isInteger(entryId)) {
      return await renderIndex(req, res, { error: 'Invalid entry id.' }, 400);
    }

    const entry = await DHLCompensationEntry.findOne({
      where: {
        id: entryId,
        completed: false,
      },
    });

    if (!entry) {
      return await renderIndex(req, res, { error: 'Open DHL compensation entry not found.' }, 404);
    }

    try {
      await deletePdfForEntry(entry);
    } catch (error) {
      console.error('Failed to delete DHL compensation PDF during entry deletion:', error);
      return await renderIndex(req, res, {
        error: 'Failed to delete the uploaded PDF file. The entry was not deleted.',
      }, 500);
    }

    await entry.destroy();

    res.redirect('/dhl-compensation?message=' + encodeURIComponent('Entry deleted.'));
  } catch (error) {
    next(error);
  }
};
