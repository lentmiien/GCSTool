require('dotenv').config();

const mysql = require('mysql2/promise');
const {
  collapseWhitespace,
  sanitizeMappingCode,
  cleanIrelandItemName,
  normalizeIrelandItemName,
  extractIrelandJanCode,
  buildIrelandNameKey,
} = require('../utils/irelandTaricMapping');

const APPLY = process.argv.includes('--apply');

function toTimestamp(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function chooseDisplayName(currentName, currentUpdatedAt, nextName, nextUpdatedAt) {
  if (!nextName) {
    return currentName;
  }
  if (!currentName) {
    return nextName;
  }
  return toTimestamp(nextUpdatedAt) >= toTimestamp(currentUpdatedAt) ? nextName : currentName;
}

function updateDateBounds(target, createdAt, updatedAt) {
  if (!target.createdAt || toTimestamp(createdAt) < toTimestamp(target.createdAt)) {
    target.createdAt = createdAt;
  }
  if (!target.updatedAt || toTimestamp(updatedAt) > toTimestamp(target.updatedAt)) {
    target.updatedAt = updatedAt;
  }
}

async function loadRows(connection) {
  const [rows] = await connection.query(`
    SELECT id, mappingType, janCode, itemName, itemNameNormalized, sourceHsCode, taricCode, uses, createdAt, updatedAt
    FROM irelandtaricmappings
    ORDER BY updatedAt DESC, id DESC
  `);
  return rows;
}

function buildReplacementRows(rows) {
  const janMappings = new Map();
  const nameStates = new Map();
  const janConflicts = [];
  const skippedRows = [];

  rows.forEach((row) => {
    const rawItemName = collapseWhitespace(row.itemName || row.itemNameNormalized);
    const itemName = cleanIrelandItemName(rawItemName);
    const itemNameNormalized = normalizeIrelandItemName(rawItemName);
    const sourceHsCode = sanitizeMappingCode(row.sourceHsCode);
    const taricCode = sanitizeMappingCode(row.taricCode);
    const janCode = sanitizeMappingCode(
      row.janCode
      || extractIrelandJanCode(row.itemName)
      || extractIrelandJanCode(row.itemNameNormalized)
      || extractIrelandJanCode(rawItemName)
    );
    const uses = Number(row.uses || 0);
    const createdAt = row.createdAt || new Date();
    const updatedAt = row.updatedAt || createdAt;
    const hasJanCode = Boolean(janCode);

    if (!sourceHsCode || !taricCode) {
      skippedRows.push({
        id: row.id,
        mappingType: row.mappingType,
        janCode,
        itemName: row.itemName,
        sourceHsCode,
        taricCode,
      });
      return;
    }

    if (hasJanCode) {
      if (!janMappings.has(janCode)) {
        janMappings.set(janCode, {
          mappingType: 'jan',
          janCode,
          itemName,
          itemNameNormalized,
          sourceHsCode,
          taricCode,
          uses,
          createdAt,
          updatedAt,
          latestItemNameUpdatedAt: updatedAt,
        });
      } else {
        const existingJan = janMappings.get(janCode);
        if (existingJan.sourceHsCode !== sourceHsCode || existingJan.taricCode !== taricCode) {
          janConflicts.push({
            janCode,
            existing: {
              sourceHsCode: existingJan.sourceHsCode,
              taricCode: existingJan.taricCode,
            },
            incoming: {
              id: row.id,
              sourceHsCode,
              taricCode,
            },
          });
        } else {
          existingJan.itemName = chooseDisplayName(
            existingJan.itemName,
            existingJan.latestItemNameUpdatedAt,
            itemName,
            updatedAt
          );
          if (itemNameNormalized) {
            existingJan.itemNameNormalized = itemNameNormalized;
          }
          existingJan.uses += uses;
          updateDateBounds(existingJan, createdAt, updatedAt);
          if (toTimestamp(updatedAt) >= toTimestamp(existingJan.latestItemNameUpdatedAt)) {
            existingJan.latestItemNameUpdatedAt = updatedAt;
          }
        }
      }
    }

    if (!itemNameNormalized) {
      return;
    }

    const nameKey = buildIrelandNameKey(itemNameNormalized, sourceHsCode);
    if (!nameStates.has(nameKey)) {
      nameStates.set(nameKey, {
        mappingType: 'name_hs',
        janCode: null,
        itemName,
        itemNameNormalized,
        sourceHsCode,
        taricCodes: new Set(),
        nameHsUses: 0,
        janUses: 0,
        createdAt,
        updatedAt,
        latestItemNameUpdatedAt: updatedAt,
      });
    }

    const nameState = nameStates.get(nameKey);
    nameState.itemName = chooseDisplayName(
      nameState.itemName,
      nameState.latestItemNameUpdatedAt,
      itemName,
      updatedAt
    );
    if (toTimestamp(updatedAt) >= toTimestamp(nameState.latestItemNameUpdatedAt)) {
      nameState.latestItemNameUpdatedAt = updatedAt;
    }
    nameState.taricCodes.add(taricCode);
    updateDateBounds(nameState, createdAt, updatedAt);

    if (row.mappingType === 'name_hs') {
      nameState.nameHsUses += uses;
    }
    if (hasJanCode || row.mappingType === 'jan') {
      nameState.janUses += uses;
    }
  });

  if (janConflicts.length > 0) {
    const error = new Error('Conflicting TARIC/source HS values found for the same JAN/barcode.');
    error.details = janConflicts;
    throw error;
  }

  const janRows = Array.from(janMappings.values())
    .map((entry) => ({
      mappingType: entry.mappingType,
      janCode: entry.janCode,
      itemName: entry.itemName,
      itemNameNormalized: entry.itemNameNormalized,
      sourceHsCode: entry.sourceHsCode,
      taricCode: entry.taricCode,
      uses: entry.uses,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => a.janCode.localeCompare(b.janCode));

  const ambiguousNameKeys = [];
  const safeNameRows = [];

  Array.from(nameStates.values())
    .sort((a, b) => {
      if (a.sourceHsCode < b.sourceHsCode) return -1;
      if (a.sourceHsCode > b.sourceHsCode) return 1;
      return a.itemNameNormalized.localeCompare(b.itemNameNormalized);
    })
    .forEach((entry) => {
      const taricCodes = Array.from(entry.taricCodes).filter(Boolean).sort();
      if (taricCodes.length === 0) {
        return;
      }
      if (taricCodes.length > 1) {
        ambiguousNameKeys.push({
          itemName: entry.itemName,
          itemNameNormalized: entry.itemNameNormalized,
          sourceHsCode: entry.sourceHsCode,
          taricCodes,
          existingUses: entry.nameHsUses,
          janUses: entry.janUses,
        });
        return;
      }
      safeNameRows.push({
        mappingType: 'name_hs',
        janCode: null,
        itemName: entry.itemName,
        itemNameNormalized: entry.itemNameNormalized,
        sourceHsCode: entry.sourceHsCode,
        taricCode: taricCodes[0],
        uses: Math.max(entry.nameHsUses, entry.janUses, 1),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    });

  return {
    janRows,
    safeNameRows,
    ambiguousNameKeys,
    skippedRows,
  };
}

async function replaceRows(connection, replacementRows) {
  await connection.beginTransaction();
  try {
    await connection.query('DELETE FROM irelandtaricmappings');
    if (replacementRows.length > 0) {
      await connection.query(
        `
          INSERT INTO irelandtaricmappings
            (mappingType, janCode, itemName, itemNameNormalized, sourceHsCode, taricCode, uses, createdAt, updatedAt)
          VALUES ?
        `,
        [replacementRows.map((row) => ([
          row.mappingType,
          row.janCode,
          row.itemName,
          row.itemNameNormalized,
          row.sourceHsCode,
          row.taricCode,
          row.uses,
          row.createdAt,
          row.updatedAt,
        ]))]
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME_GCS,
  });

  try {
    const rows = await loadRows(connection);
    const { janRows, safeNameRows, ambiguousNameKeys, skippedRows } = buildReplacementRows(rows);
    const replacementRows = janRows.concat(safeNameRows);

    const report = {
      mode: APPLY ? 'apply' : 'dry-run',
      originalRows: rows.length,
      replacementRows: replacementRows.length,
      janRows: janRows.length,
      safeNameHsRows: safeNameRows.length,
      skippedRows: skippedRows.length,
      ambiguousNameHsKeys: ambiguousNameKeys.length,
      ambiguousExamples: ambiguousNameKeys.slice(0, 20),
    };

    if (APPLY) {
      await replaceRows(connection, replacementRows);
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err.details ? JSON.stringify(err.details, null, 2) : err);
  process.exitCode = 1;
});
