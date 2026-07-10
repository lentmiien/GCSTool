const irelandBarcodePattern = /\s*[\[(]\s*barcode\s*([0-9]{8,14})\s*[\])]\s*$/i;
const irelandNumericBarcodePattern = /^[0-9]+$/;

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeMappingCode(value) {
  return collapseWhitespace(value);
}

function sanitizeIrelandJanCode(value) {
  const janCode = collapseWhitespace(value);
  return irelandNumericBarcodePattern.test(janCode) ? janCode : '';
}

function splitIrelandItemBarcode(value) {
  const itemName = String(value || '');
  const lastSlashIndex = itemName.lastIndexOf('/');

  if (lastSlashIndex !== -1) {
    const janCode = itemName.slice(lastSlashIndex + 1).trim();
    if (irelandNumericBarcodePattern.test(janCode)) {
      return {
        itemName: itemName.slice(0, lastSlashIndex),
        janCode,
      };
    }
  }

  const legacyMatch = itemName.match(irelandBarcodePattern);
  if (legacyMatch) {
    return {
      itemName: itemName.slice(0, legacyMatch.index),
      janCode: legacyMatch[1],
    };
  }

  return {
    itemName,
    janCode: '',
  };
}

function removeIrelandBarcodeSuffix(value) {
  return collapseWhitespace(splitIrelandItemBarcode(value).itemName);
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
  return splitIrelandItemBarcode(value).janCode;
}

function buildIrelandNameKey(itemNameNormalized, sourceHsCode) {
  return `${itemNameNormalized}__${sourceHsCode}`;
}

module.exports = {
  irelandBarcodePattern,
  irelandNumericBarcodePattern,
  collapseWhitespace,
  sanitizeMappingCode,
  sanitizeIrelandJanCode,
  splitIrelandItemBarcode,
  cleanIrelandItemName,
  normalizeIrelandItemName,
  extractIrelandJanCode,
  buildIrelandNameKey,
};
