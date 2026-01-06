// Constants
const AIT_UPDATES_CONTENT_ID = parseInt(process.env.AIT_UPDATES_CONTENT_ID);
const path = require('path');
const fs = require('fs');
const { ready } = require('zpl-renderer-js');

// Require necessary database models
const { Content } = require('../sequelize');
const TMP_DIR = path.join(__dirname, '..', 'public', 'tmp');
let zplRenderer = null;

async function getRenderer() {
  if (zplRenderer) {
    return zplRenderer;
  }
  const { api } = await ready;
  zplRenderer = api;
  return zplRenderer;
}

function splitZplLabels(zplContent) {
  return zplContent
    .split(/\^XZ/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part}\n^XZ`);
}

async function writeImage(base64, filepath) {
  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;
  const buffer = Buffer.from(cleaned, 'base64');
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
  await fs.promises.writeFile(filepath, buffer);
}

// Run for every connection (verify/log users, etc.)
exports.all = function (req, res, next) {
  // This endpoint is for Lennart test stuff
  if (req.user.userid == 'Lennart') {
    next();
  } else {
    res.redirect('/');
  }
};

// Landing page
exports.index = (req, res) => {
  res.render('lennart_top', { i18n: res.__ });
};

exports.zpl = (req, res) => {
  res.render('lennart_zpl', { i18n: res.__, images: [], error: null });
};

exports.convertZpl = async (req, res) => {
  try {
    if (!req.files || !req.files.zplFile) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'Please upload a ZPL file.' });
    }

    const upload = Array.isArray(req.files.zplFile) ? req.files.zplFile[0] : req.files.zplFile;
    const rawContent = upload.data.toString('utf8').trim();
    if (!rawContent) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'The uploaded file is empty.' });
    }

    const labels = splitZplLabels(rawContent);
    if (labels.length === 0) {
      return res.status(400).render('lennart_zpl', { i18n: res.__, images: [], error: 'No labels found in the uploaded ZPL.' });
    }

    const renderer = await getRenderer();
    const timestamp = Date.now();
    const images = [];

    for (let i = 0; i < labels.length; i++) {
      const pngBase64 = await renderer.zplToBase64Async(labels[i]);
      const filename = `zpl_${timestamp}_${i + 1}.png`;
      const filepath = path.join(TMP_DIR, filename);
      await writeImage(pngBase64, filepath);
      images.push(`/tmp/${filename}`);
    }

    res.render('lennart_zpl', { i18n: res.__, images, error: null });
  } catch (err) {
    console.error('ZPL conversion failed:', err);
    res.status(500).render('lennart_zpl', { i18n: res.__, images: [], error: 'Failed to convert the ZPL file. Please try again.' });
  }
};

// Update the AIT manual content, need to set AIT_UPDATES_CONTENT_ID to correct id value to work
exports.updateait = (req, res) => {
  if (AIT_UPDATES_CONTENT_ID != -1) {
    Content.update({ data: req.body.data }, { where: { id: AIT_UPDATES_CONTENT_ID } }).then(() => {
      res.json({ status: 'updated!' });
    });
  } else {
    res.json({ status: "Can't update index -1, please set AIT_UPDATES_CONTENT_ID to correct value and restart server..." });
  }
};
