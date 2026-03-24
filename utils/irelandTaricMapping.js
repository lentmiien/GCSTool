const irelandBarcodePattern = /\s*[\[(]\s*barcode\s*([0-9]{8,14})\s*[\])]\s*$/i;

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeMappingCode(value) {
  return collapseWhitespace(value);
}

function removeIrelandBarcodeSuffix(value) {
  return collapseWhitespace(String(value || '').replace(irelandBarcodePattern, ' '));
}

function removeToyPrefix(value) {
  return collapseWhitespace(String(value || '').replace(/^toy\b[\s-]*/i, ' '));
}

function cleanIrelandItemName(value) {
  const cleanedValue = removeToyPrefix(removeIrelandBarcodeSuffix(value));
  if (cleanedValue && cleanedValue === cleanedValue.toLowerCase()) {
    return cleanedValue.charAt(0).toUpperCase() + cleanedValue.slice(1);
  }
  return cleanedValue;
}

function normalizeIrelandItemName(value) {
  return cleanIrelandItemName(value).toLowerCase();
}

function extractIrelandJanCode(value) {
  const match = String(value || '').match(irelandBarcodePattern);
  return match ? match[1] : '';
}

function buildIrelandNameKey(itemNameNormalized, sourceHsCode) {
  return `${itemNameNormalized}__${sourceHsCode}`;
}

module.exports = {
  irelandBarcodePattern,
  collapseWhitespace,
  sanitizeMappingCode,
  cleanIrelandItemName,
  normalizeIrelandItemName,
  extractIrelandJanCode,
  buildIrelandNameKey,
};
