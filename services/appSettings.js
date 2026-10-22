const APP_SETTING_KEYS = Object.freeze({
  SMALLEST_BOX_API_KEY: 'SMALLEST_BOX_API_KEY',
  SHIPPING_COMPACTOR_COUNTRIES: 'SHIPPING_COMPACTOR_COUNTRIES',
  INVOICE_SHIPPING_METHODS: 'INVOICE_SHIPPING_METHODS',
  SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT: 'SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT',
  SHORTEN_ITEM_NAMES_MODEL: 'SHORTEN_ITEM_NAMES_MODEL',
  SHORTEN_ITEM_NAMES_REASONING_EFFORT: 'SHORTEN_ITEM_NAMES_REASONING_EFFORT',
});

const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;

const REASONING_EFFORTS = Object.freeze([
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);

const DEFAULT_APP_SETTINGS = Object.freeze({
  [APP_SETTING_KEYS.SMALLEST_BOX_API_KEY]: '',
  // Broad Europe, including transcontinental destinations and territories with
  // their own shipping codes. Admins can replace this list in App settings.
  [APP_SETTING_KEYS.SHIPPING_COMPACTOR_COUNTRIES]: [
    'AD', 'AL', 'AM', 'AT', 'AX', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY',
    'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GE', 'GG', 'GI',
    'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'KZ', 'LI', 'LT', 'LU',
    'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS',
    'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK',
  ].join(', '),
  [APP_SETTING_KEYS.INVOICE_SHIPPING_METHODS]: [
    'Air Parcel',
    'Air Small Packet',
    'DHL',
    'EMS',
    'SAL Parcel',
    'SAL Small Packet',
    'International ePacket Light',
    'Surface Mail Premium',
    'Surface Parcel',
    'ECMS',
  ].join(', '),
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT]: new Date(
    Date.now() - TWO_WEEKS_IN_MS,
  ).toISOString(),
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL]: 'gpt-5.6-luna',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT]: 'low',
});

const APP_SETTING_DESCRIPTIONS = Object.freeze({
  [APP_SETTING_KEYS.SMALLEST_BOX_API_KEY]: 'Bearer API key from my.lentmiien.com → binpacking-smallest → API access. Used by /smallest-box. Leave blank to keep the saved key, or select Remove key to clear it.',
  [APP_SETTING_KEYS.SHIPPING_COMPACTOR_COUNTRIES]: 'Country codes processed by /hs/compact, separated by commas (for example IE, GR). Use two-letter destination codes from the CSV. Empty means no countries are processed. Reload the compactor and download a new standalone HTML after changes.',
  [APP_SETTING_KEYS.INVOICE_SHIPPING_METHODS]: 'Comma-separated shipping methods shown by /api/invoice.',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT]: 'ISO date-time of the last /chatgpt/language_tools run.',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL]: 'OpenAI model used by /chatgpt/language_tools.',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT]: 'Reasoning effort used by /chatgpt/language_tools.',
});

function parseAppSettingDate(value) {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseInvoiceShippingMethods(value) {
  return String(value || '')
    .split(',')
    .map((method) => method.trim())
    .filter((method, index, methods) => method && methods.indexOf(method) === index);
}

function parseShippingCompactorCountries(value) {
  const codes = String(value || '').split(',').map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (codes.some((code) => !/^[A-Z]{2}$/.test(code))) {
    throw new TypeError('Compactor countries must be comma-separated two-letter country codes (for example IE, GR).');
  }
  return [...new Set(codes)];
}

async function getShippingCompactorCountries(AppSetting) {
  const entry = await AppSetting.findOne({
    where: { key: APP_SETTING_KEYS.SHIPPING_COMPACTOR_COUNTRIES },
  });
  return parseShippingCompactorCountries(entry
    ? entry.value : DEFAULT_APP_SETTINGS[APP_SETTING_KEYS.SHIPPING_COMPACTOR_COUNTRIES]);
}

async function seedAppSettings(AppSetting) {
  for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
    await AppSetting.findOrCreate({
      where: { key },
      defaults: { value },
    });
  }
}

async function getShortenItemNamesSettings(AppSetting) {
  const keys = [
    APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL,
    APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT,
  ];
  const entries = await AppSetting.findAll({
    where: { key: keys },
  });
  const settings = { ...DEFAULT_APP_SETTINGS };

  entries.forEach((entry) => {
    settings[entry.key] = entry.value;
  });

  const configuredModel = settings[APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL].trim();
  const configuredReasoningEffort = settings[APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT].trim();
  const model = configuredModel || DEFAULT_APP_SETTINGS[APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL];
  const reasoningEffort = REASONING_EFFORTS.includes(configuredReasoningEffort)
    ? configuredReasoningEffort
    : DEFAULT_APP_SETTINGS[APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT];

  if (reasoningEffort !== configuredReasoningEffort) {
    console.warn(
      `Invalid ${APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT} setting; using "${reasoningEffort}".`,
    );
  }

  return { model, reasoningEffort };
}

async function getShortenItemNamesLastProcessedAt(AppSetting) {
  const entry = await AppSetting.findOne({
    where: { key: APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT },
  });
  const configuredDate = parseAppSettingDate(entry && entry.value);

  if (configuredDate) {
    return configuredDate;
  }

  if (entry) {
    console.warn(
      `Invalid ${APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT} setting; using the default date.`,
    );
  }

  return new Date(DEFAULT_APP_SETTINGS[APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT]);
}

async function setShortenItemNamesLastProcessedAt(AppSetting, value) {
  const lastProcessedAt = parseAppSettingDate(value);
  if (!lastProcessedAt) {
    throw new TypeError('Last processed date must be a valid date.');
  }

  await AppSetting.upsert({
    key: APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_LAST_PROCESSED_AT,
    value: lastProcessedAt.toISOString(),
  });

  return lastProcessedAt;
}

async function getInvoiceShippingMethods(AppSetting) {
  const entry = await AppSetting.findOne({
    where: { key: APP_SETTING_KEYS.INVOICE_SHIPPING_METHODS },
  });
  const configuredMethods = parseInvoiceShippingMethods(entry && entry.value);

  if (configuredMethods.length > 0) {
    return configuredMethods;
  }

  return parseInvoiceShippingMethods(
    DEFAULT_APP_SETTINGS[APP_SETTING_KEYS.INVOICE_SHIPPING_METHODS],
  );
}

module.exports = {
  APP_SETTING_DESCRIPTIONS,
  APP_SETTING_KEYS,
  DEFAULT_APP_SETTINGS,
  REASONING_EFFORTS,
  getInvoiceShippingMethods,
  getShippingCompactorCountries,
  getShortenItemNamesLastProcessedAt,
  getShortenItemNamesSettings,
  parseAppSettingDate,
  parseInvoiceShippingMethods,
  parseShippingCompactorCountries,
  seedAppSettings,
  setShortenItemNamesLastProcessedAt,
};
