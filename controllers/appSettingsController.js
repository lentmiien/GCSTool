const { AppSetting } = require('../sequelize');
const {
  APP_SETTING_DESCRIPTIONS,
  APP_SETTING_KEYS,
  REASONING_EFFORTS,
} = require('../services/appSettings');

const SETTING_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;

function requireAdmin(req, res) {
  if (req.user && req.user.role === 'admin') {
    return true;
  }

  res.status(403).render('s_added', { message: 'Only admin staff can manage app settings.' });
  return false;
}

function redirectWithMessage(res, type, message) {
  res.redirect(303, `/admin/app-settings?${type}=${encodeURIComponent(message)}`);
}

function validateValue(key, value) {
  if (key === APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL && !value) {
    return 'The OpenAI model cannot be empty.';
  }

  if (
    key === APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT
    && !REASONING_EFFORTS.includes(value)
  ) {
    return `Reasoning effort must be one of: ${REASONING_EFFORTS.join(', ')}.`;
  }

  return null;
}

exports.index = async (req, res, next) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const settings = await AppSetting.findAll({ order: [['key', 'ASC']] });
    res.render('app_settings', {
      descriptions: APP_SETTING_DESCRIPTIONS,
      error: req.query.error,
      message: req.query.message,
      reasoningEffortKey: APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT,
      reasoningEfforts: REASONING_EFFORTS,
      settings,
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const key = String(req.body.key || '').trim();
  const value = String(req.body.value || '').trim();

  if (!SETTING_KEY_PATTERN.test(key)) {
    return redirectWithMessage(
      res,
      'error',
      'Keys must use uppercase letters, numbers, and underscores, and must start with a letter.',
    );
  }

  const validationError = validateValue(key, value);
  if (validationError) {
    return redirectWithMessage(res, 'error', validationError);
  }

  try {
    await AppSetting.create({ key, value });
    return redirectWithMessage(res, 'message', `Added ${key}.`);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return redirectWithMessage(res, 'error', `${key} already exists.`);
    }

    console.error('Failed to create app setting:', error);
    return redirectWithMessage(res, 'error', 'Failed to add the app setting.');
  }
};

exports.update = async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const setting = await AppSetting.findByPk(req.params.id);
    if (!setting) {
      return redirectWithMessage(res, 'error', 'App setting not found.');
    }

    const value = String(req.body.value || '').trim();
    const validationError = validateValue(setting.key, value);
    if (validationError) {
      return redirectWithMessage(res, 'error', validationError);
    }

    await setting.update({ value });
    return redirectWithMessage(res, 'message', `Updated ${setting.key}.`);
  } catch (error) {
    console.error('Failed to update app setting:', error);
    return redirectWithMessage(res, 'error', 'Failed to update the app setting.');
  }
};
