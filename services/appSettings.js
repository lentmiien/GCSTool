const APP_SETTING_KEYS = Object.freeze({
  INVOICE_SHIPPING_METHODS: 'INVOICE_SHIPPING_METHODS',
  SHORTEN_ITEM_NAMES_MODEL: 'SHORTEN_ITEM_NAMES_MODEL',
  SHORTEN_ITEM_NAMES_REASONING_EFFORT: 'SHORTEN_ITEM_NAMES_REASONING_EFFORT',
});

const REASONING_EFFORTS = Object.freeze([
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);

const DEFAULT_APP_SETTINGS = Object.freeze({
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
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL]: 'gpt-5.6-luna',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT]: 'low',
});

const APP_SETTING_DESCRIPTIONS = Object.freeze({
  [APP_SETTING_KEYS.INVOICE_SHIPPING_METHODS]: 'Comma-separated shipping methods shown by /api/invoice.',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_MODEL]: 'OpenAI model used by /chatgpt/language_tools.',
  [APP_SETTING_KEYS.SHORTEN_ITEM_NAMES_REASONING_EFFORT]: 'Reasoning effort used by /chatgpt/language_tools.',
});

function parseInvoiceShippingMethods(value) {
  return String(value || '')
    .split(',')
    .map((method) => method.trim())
    .filter((method, index, methods) => method && methods.indexOf(method) === index);
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
  getShortenItemNamesSettings,
  parseInvoiceShippingMethods,
  seedAppSettings,
};
