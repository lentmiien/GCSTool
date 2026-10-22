const { AppSetting } = require('../sequelize');
const { PackingError, buildRequest, callApi } = require('../services/smallestBox');

// The configured key has a shared issuer limit, even across different users/tabs.
let searchRunning = false;

function sendError(res, error) {
  if (error.retryAfter && /^(\d+|[\w, :+-]+)$/.test(String(error.retryAfter))) res.set('Retry-After', String(error.retryAfter));
  res.status(error instanceof PackingError ? error.status : 503).json({
    success: false,
    message: error instanceof PackingError ? error.message : 'Packing settings are unavailable. Please try again later.',
  });
}

exports.index = (req, res) => res.render('smallestbox', { pagetitle: 'Smallest box finder · GCS Support Tool' });

exports.containers = async (req, res) => {
  try {
    res.json(await callApi(AppSetting));
  } catch (error) {
    sendError(res, error);
  }
};

exports.pack = async (req, res) => {
  if (searchRunning) return sendError(res, new PackingError('A packing search is already running. Please wait before trying again.', 429, '5'));
  searchRunning = true;
  try {
    const payload = buildRequest(req.body);
    res.json(await callApi(AppSetting, payload));
  } catch (error) {
    sendError(res, error);
  } finally {
    searchRunning = false;
  }
};
