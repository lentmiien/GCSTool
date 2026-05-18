// Require used packages
const csv = require('csvtojson');

// Require necessary database models
const { HSCodeList, IrelandTaricMapping, IrelandTaricExplanation, IrelandWorkSummary, Op } = require('../sequelize');
const {
  collapseWhitespace,
  sanitizeMappingCode,
  cleanIrelandItemName,
  normalizeIrelandItemName,
  extractIrelandJanCode,
  buildIrelandNameKey,
} = require('../utils/irelandTaricMapping');
// TODO: Load old data to DB first time
const old_data = require('../data/recommended.json');
HSCodeList.findAll().then(entries => {
  // Create a lookup list
  const entries_lookup = [];
  entries.forEach(data => {
    entries_lookup.push(data.name);
  });

  // Determine which entries that are new (if any)
  const new_entries = [];
  old_data.forEach(data => {
    const index = entries_lookup.indexOf(data.name);
    if (index == -1) {
      new_entries.push({
        name: data.name,
        code: data.code,
        uses: data.uses
      });
    }
  });

  // If there were any new entries, then add to database
  if (new_entries.length > 0) {
    // Should only ever occurr once, or if "recommended.json" updated
    HSCodeList.bulkCreate(new_entries);
  }
});

let sections = []
let headings = []
let sections_lookup = {}
let headings_lookup = {}
async function LoadData() {
  sections = await csv().fromFile('./data/sections.csv')
  headings = await csv().fromFile('./data/harmonized-system.csv')

  // Generate lookup objects
  sections.forEach(section => {
    sections_lookup[section.section] = section.name
  })
  headings.forEach(heading => {
    // section,hscode,description,parent,level
    headings_lookup[heading.hscode] = {
      section: heading.section,
      description: heading.description,
      parent: heading.parent,
      level: heading.level
    }
  })
}
LoadData()

async function saveIrelandTaricMappings(entries) {
  const janMappings = new Map();
  const nameMappings = new Map();

  entries.forEach((entry) => {
    const sourceHsCode = sanitizeMappingCode(entry.sourceHsCode);
    const taricCode = sanitizeMappingCode(entry.taricCode);
    const rawItemName = collapseWhitespace(entry.itemName || entry.itemNameNormalized);
    const itemName = cleanIrelandItemName(rawItemName);
    const itemNameNormalized = normalizeIrelandItemName(rawItemName);
    const janCode = sanitizeMappingCode(
      entry.janCode
      || extractIrelandJanCode(rawItemName)
      || extractIrelandJanCode(entry.itemNameNormalized)
    );

    if (!sourceHsCode || !taricCode) {
      return;
    }

    if (janCode) {
      if (janMappings.has(janCode)) {
        const currJan = janMappings.get(janCode);
        currJan.taricCode = taricCode;
        currJan.sourceHsCode = sourceHsCode;
        currJan.itemName = itemName || currJan.itemName;
        currJan.itemNameNormalized = itemNameNormalized || currJan.itemNameNormalized;
        currJan.uses += 1;
      } else {
        janMappings.set(janCode, {
          janCode,
          itemName,
          itemNameNormalized,
          sourceHsCode,
          taricCode,
          uses: 1,
        });
      }
    }

    if (itemNameNormalized) {
      const itemKey = buildIrelandNameKey(itemNameNormalized, sourceHsCode);
      if (nameMappings.has(itemKey)) {
        const currName = nameMappings.get(itemKey);
        currName.taricCode = taricCode;
        currName.itemName = itemName || currName.itemName;
        currName.uses += 1;
      } else {
        nameMappings.set(itemKey, {
          itemName,
          itemNameNormalized,
          sourceHsCode,
          taricCode,
          uses: 1,
        });
      }
    }
  });

  let created = 0;
  let updated = 0;
  let deleted = 0;

  const janCodes = Array.from(janMappings.keys());
  if (janCodes.length > 0) {
    const existingJanMappings = await IrelandTaricMapping.findAll({
      where: {
        mappingType: 'jan',
        janCode: {
          [Op.in]: janCodes,
        },
      },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    });
    const existingJanLookup = {};
    existingJanMappings.forEach((entry) => {
      if (!existingJanLookup[entry.janCode]) {
        existingJanLookup[entry.janCode] = [];
      }
      existingJanLookup[entry.janCode].push(entry);
    });

    for (const janCode of janCodes) {
      const mapping = janMappings.get(janCode);
      const existingEntries = existingJanLookup[janCode] || [];
      const existing = existingEntries[0];
      const existingUses = existingEntries.reduce((sum, entry) => sum + Number(entry.uses || 0), 0);
      const duplicateJanIds = existingEntries.slice(1).map((entry) => entry.id);
      if (existing) {
        await IrelandTaricMapping.update({
          itemName: mapping.itemName,
          itemNameNormalized: mapping.itemNameNormalized,
          sourceHsCode: mapping.sourceHsCode,
          taricCode: mapping.taricCode,
          uses: existingUses + mapping.uses,
        }, { where: { id: existing.id } });
        if (duplicateJanIds.length > 0) {
          await IrelandTaricMapping.destroy({
            where: {
              id: {
                [Op.in]: duplicateJanIds,
              },
            },
          });
          deleted += duplicateJanIds.length;
        }
        updated += 1;
      } else {
        await IrelandTaricMapping.create({
          mappingType: 'jan',
          janCode: mapping.janCode,
          itemName: mapping.itemName,
          itemNameNormalized: mapping.itemNameNormalized,
          sourceHsCode: mapping.sourceHsCode,
          taricCode: mapping.taricCode,
          uses: mapping.uses,
        });
        created += 1;
      }
    }
  }

  const nameKeys = Array.from(nameMappings.keys());
  if (nameKeys.length > 0) {
    const relevantMappings = await IrelandTaricMapping.findAll({
      where: {
        [Op.or]: nameKeys.map((itemKey) => {
          const mapping = nameMappings.get(itemKey);
          return {
            itemNameNormalized: mapping.itemNameNormalized,
            sourceHsCode: mapping.sourceHsCode,
          };
        }),
      },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    });
    const nameKeyState = new Map();

    const ensureNameState = (itemKey, fallback) => {
      if (!nameKeyState.has(itemKey)) {
        nameKeyState.set(itemKey, {
          itemName: fallback && fallback.itemName ? fallback.itemName : '',
          itemNameNormalized: fallback ? fallback.itemNameNormalized : '',
          sourceHsCode: fallback ? fallback.sourceHsCode : '',
          incomingUses: 0,
          existingUses: 0,
          taricCodes: new Set(),
          existingEntries: [],
        });
      }
      return nameKeyState.get(itemKey);
    };

    relevantMappings.forEach((entry) => {
      const itemKey = buildIrelandNameKey(entry.itemNameNormalized, entry.sourceHsCode);
      if (!nameMappings.has(itemKey)) {
        return;
      }
      const state = ensureNameState(itemKey, entry);
      if (entry.itemName && !state.itemName) {
        state.itemName = entry.itemName;
      }
      if (entry.taricCode) {
        state.taricCodes.add(sanitizeMappingCode(entry.taricCode));
      }
      if (entry.mappingType === 'name_hs') {
        state.existingEntries.push(entry);
        state.existingUses += Number(entry.uses || 0);
      }
    });

    nameMappings.forEach((mapping, itemKey) => {
      const state = ensureNameState(itemKey, mapping);
      state.itemName = mapping.itemName || state.itemName;
      state.itemNameNormalized = mapping.itemNameNormalized;
      state.sourceHsCode = mapping.sourceHsCode;
      state.incomingUses = mapping.uses;
      if (mapping.taricCode) {
        state.taricCodes.add(mapping.taricCode);
      }
    });

    for (const itemKey of nameKeys) {
      const mapping = nameMappings.get(itemKey);
      const state = nameKeyState.get(itemKey);
      const existingEntries = state ? state.existingEntries : [];
      const distinctTarics = state ? Array.from(state.taricCodes).filter(Boolean) : [];

      if (distinctTarics.length > 1) {
        if (existingEntries.length > 0) {
          await IrelandTaricMapping.destroy({
            where: {
              id: {
                [Op.in]: existingEntries.map((entry) => entry.id),
              },
            },
          });
          deleted += existingEntries.length;
        }
        continue;
      }

      const existing = existingEntries[0];
      const duplicateNameIds = existingEntries.slice(1).map((entry) => entry.id);
      if (existing) {
        await IrelandTaricMapping.update({
          itemName: mapping.itemName,
          itemNameNormalized: mapping.itemNameNormalized,
          sourceHsCode: mapping.sourceHsCode,
          taricCode: mapping.taricCode,
          uses: state.existingUses + state.incomingUses,
        }, { where: { id: existing.id } });
        if (duplicateNameIds.length > 0) {
          await IrelandTaricMapping.destroy({
            where: {
              id: {
                [Op.in]: duplicateNameIds,
              },
            },
          });
          deleted += duplicateNameIds.length;
        }
        updated += 1;
      } else {
        await IrelandTaricMapping.create({
          mappingType: 'name_hs',
          itemName: mapping.itemName,
          itemNameNormalized: mapping.itemNameNormalized,
          sourceHsCode: mapping.sourceHsCode,
          taricCode: mapping.taricCode,
          uses: mapping.uses,
        });
        created += 1;
      }
    }
  }

  return {
    created,
    updated,
    deleted,
    saved: created + updated,
  };
}

function toArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function truncateText(value, maxLength) {
  const text = collapseWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}

function addUniqueText(list, value, limit) {
  const text = collapseWhitespace(value);
  if (!text || list.indexOf(text) !== -1 || list.length >= limit) {
    return;
  }
  list.push(text);
}

function buildTaricExplanationLookup(taricExplanations) {
  const lookup = {};
  taricExplanations.forEach((entry) => {
    const data = entry.toJSON ? entry.toJSON() : entry;
    const taricCode = sanitizeMappingCode(data.taricCode);
    if (taricCode) {
      lookup[taricCode] = collapseWhitespace(data.explanation);
    }
  });
  return lookup;
}

function buildTaricMappingsForEditor(taricMappings, taricExplanations) {
  const explanationLookup = buildTaricExplanationLookup(taricExplanations);
  return taricMappings.map((entry) => {
    const data = entry.toJSON ? entry.toJSON() : entry;
    const taricCode = sanitizeMappingCode(data.taricCode);
    return Object.assign({}, data, {
      explanation: taricCode ? explanationLookup[taricCode] || '' : '',
    });
  });
}

function buildTaricExplanationRows(taricMappings, taricExplanations) {
  const explanationLookup = buildTaricExplanationLookup(taricExplanations);
  const codeState = new Map();

  taricMappings.forEach((entry) => {
    const data = entry.toJSON ? entry.toJSON() : entry;
    const taricCode = sanitizeMappingCode(data.taricCode);
    if (!taricCode) {
      return;
    }

    if (!codeState.has(taricCode)) {
      codeState.set(taricCode, {
        taricCode,
        uses: 0,
        mappingCount: 0,
        sourceHsCodes: [],
        examples: [],
        explanation: explanationLookup[taricCode] || '',
      });
    }

    const state = codeState.get(taricCode);
    state.uses += Number(data.uses || 0);
    state.mappingCount += 1;
    addUniqueText(state.sourceHsCodes, sanitizeMappingCode(data.sourceHsCode), 8);
    addUniqueText(state.examples, truncateText(cleanIrelandItemName(data.itemName || data.itemNameNormalized), 70), 5);
  });

  return Array.from(codeState.values())
    .map((entry) => Object.assign({}, entry, {
      hasExplanation: Boolean(collapseWhitespace(entry.explanation)),
      sourceHsCodesText: entry.sourceHsCodes.join(', '),
      examplesText: entry.examples.join(', '),
    }))
    .sort((a, b) => {
      if (a.hasExplanation !== b.hasExplanation) {
        return a.hasExplanation ? 1 : -1;
      }
      if (a.uses !== b.uses) {
        return b.uses - a.uses;
      }
      return a.taricCode.localeCompare(b.taricCode);
    });
}

async function saveIrelandTaricExplanations(codes, explanations) {
  const taricCodes = toArray(codes);
  const explanationValues = toArray(explanations);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (let i = 0; i < taricCodes.length; i++) {
    const taricCode = sanitizeMappingCode(taricCodes[i]);
    const explanation = collapseWhitespace(explanationValues[i]);
    if (!taricCode) {
      continue;
    }

    const existing = await IrelandTaricExplanation.findOne({
      where: { taricCode },
    });

    if (!explanation) {
      if (existing) {
        await existing.destroy();
        deleted += 1;
      }
      continue;
    }

    if (existing) {
      if (existing.explanation !== explanation) {
        await existing.update({ explanation });
        updated += 1;
      }
    } else {
      await IrelandTaricExplanation.create({
        taricCode,
        explanation,
      });
      created += 1;
    }
  }

  return {
    created,
    updated,
    deleted,
    saved: created + updated,
  };
}

function getJstDateString(date) {
  const jstDate = new Date((date ? date.getTime() : Date.now()) + (9 * 60 * 60 * 1000));
  return jstDate.toISOString().slice(0, 10);
}

function getJstMonthString(date) {
  return getJstDateString(date).slice(0, 7);
}

function normalizeMonth(value) {
  const month = collapseWhitespace(value);
  return /^\d{4}-\d{2}$/.test(month) ? month : getJstMonthString();
}

function parseTextLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function parseCount(value) {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function saveIrelandWorkSummaries(summaries) {
  const addedDate = getJstDateString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const summary of summaries) {
    const orderNumber = collapseWhitespace(summary.orderNumber);
    if (!orderNumber) {
      skipped += 1;
      continue;
    }

    const payload = {
      toyRemovedCount: parseCount(summary.toyRemovedCount),
      taricUpdateCount: parseCount(summary.taricUpdateCount),
      uneditedCount: parseCount(summary.uneditedCount),
    };

    const existing = await IrelandWorkSummary.findOne({
      where: { orderNumber },
    });

    if (existing) {
      await existing.update(payload);
      updated += 1;
    } else {
      await IrelandWorkSummary.create(Object.assign({
        orderNumber,
        trackingNumber: '',
        addedDate,
      }, payload));
      created += 1;
    }
  }

  return {
    created,
    updated,
    skipped,
    saved: created + updated,
  };
}

async function saveIrelandTrackingNumbers(orderNumbersText, trackingNumbersText) {
  const orderLines = parseTextLines(orderNumbersText);
  const trackingLines = parseTextLines(trackingNumbersText);
  const addedDate = getJstDateString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < orderLines.length; i++) {
    const orderNumber = collapseWhitespace(orderLines[i]);
    const trackingNumber = collapseWhitespace(trackingLines[i]);
    if (!orderNumber) {
      skipped += 1;
      continue;
    }

    const existing = await IrelandWorkSummary.findOne({
      where: { orderNumber },
    });

    if (existing) {
      await existing.update({ trackingNumber });
      updated += 1;
    } else {
      await IrelandWorkSummary.create({
        orderNumber,
        trackingNumber,
        addedDate,
        toyRemovedCount: 0,
        taricUpdateCount: 0,
        uneditedCount: 0,
      });
      created += 1;
    }
  }

  return {
    created,
    updated,
    skipped,
    saved: created + updated,
  };
}

//---------------------------------------------//
// exports.endpoints = (req, res, next) => {}; //
//---------------------------------------------//

exports.index = (req, res) => {
  res.render('hs')
};

exports.suggestions = (req, res) => {
  const suggestions = { previous: [] };
  const previous_lookup = [];

  HSCodeList.findAll().then(entries => {
    entries.forEach(prev => {
      const index = previous_lookup.indexOf(prev.code);
      if (index == -1) {
        previous_lookup.push(prev.code);
        suggestions.previous.push({
          code: prev.code,
          name: prev.name,
          uses: prev.uses
        });
      } else {
        if (suggestions.previous[index].name.length < 200) {
          suggestions.previous[index].name += `, ${prev.name}`;
        } else if (suggestions.previous[index].name.length < 250) {
          suggestions.previous[index].name += `.`;
        }
        suggestions.previous[index].uses += prev.uses;
      }
    });
    suggestions.previous.sort((a, b) => {
      if (a.uses > b.uses) return -1
      if (a.uses < b.uses) return 1
      return 0
    });

    req.body.forEach(entry => {
      suggestions[entry] = { recommended: [], close_matches: [] }
      // Check if exist in previous
      entries.forEach(prev => {
        if (prev.name.toLowerCase() === entry.toLowerCase()) {
          suggestions[entry].recommended.push({ code: prev.code, uses: prev.uses })
        }
      })
      // Sort more used first
      suggestions[entry].recommended.sort((a, b) => {
        if (a.uses > b.uses) return -1
        if (a.uses < b.uses) return 1
        return 0
      })
      // Search headings for a close match
      // 1. Split all words from "entry"
      const query = entry.toLowerCase().match(/\b(\w+)\b/g)
      // 2. Loop over all "level=6" headings (level=6 -> 6 digits 'full hs code')
      const uneeded_sections = ['I', 'II', 'III', 'IV', 'V', 'VI', 'XIX']
      headings.forEach(h => {
        if (h.level == "6" && uneeded_sections.indexOf(h.section) == -1) {
          let count = 0
          let unique = 0
          // a) Check how many of the words that exists in the heading and all parent headings
          query.forEach(q => {
            let found = false
            if (h.description.toLowerCase().indexOf(q) >= 0) {
              found = true
              count++
            }
            if (headings_lookup[h.parent].description.toLowerCase().indexOf(q) >= 0) {
              found = true
              count++
            }
            if (headings_lookup[headings_lookup[h.parent].parent].description.toLowerCase().indexOf(q) >= 0) {
              found = true
              count++
            }
            if (found) {
              unique++
            }
          })
          // b) Add to "close_matches" if 1 or more words were found (include number of found words)
          if (count > 0) {
            suggestions[entry].close_matches.push({ code: h.hscode, count, unique, length: query.length })
          }
        }
      })
      // 3. Sort "close_matches" based on number of words found
      suggestions[entry].close_matches.sort((a, b) => {
        const valA = a.unique / a.length
        const valB = b.unique / b.length
        if (valA > valB) return -1
        if (valA < valB) return 1
        return 0
      })
    })

    // Return data
    res.json({ sections_lookup, headings_lookup, suggestions })
  });
};

exports.previous = (req, res) => {
  // Prepare data to be added to database
  const toUpdate = [];
  const toUpdateLookup = [];
  req.body.forEach(used => {
    const index = toUpdateLookup.indexOf(used.name);
    if (index == -1) {
      toUpdateLookup.push(used.name);
      toUpdate.push({
        name: used.name,
        code: used.code,
        uses: 1
      });
    } else {
      toUpdate[index].uses++;
    }
  });

  // Update/Add to database
  HSCodeList.findAll().then(entries => {
    toUpdate.forEach(update => {
      let updated = false;
      entries.forEach(entry => {
        if (entry.name == update.name && entry.code == update.code) {
          // Update existing entry
          updated = true;
          HSCodeList.update({uses: entry.uses + update.uses}, { where: { id: entry.id } });
        }
      });
      if (!updated) {
        // New entry
        HSCodeList.create(update);
      }
    });
  });

  // Return something...
  res.json({ status: "OK" });
};

exports.index_v2 = (req, res) => {
  // Load database and send data to hs_v2.pug
  HSCodeList.findAll().then(entries => {
    res.render('hs_v2', { sections_lookup, headings_lookup, entries });
  });
};

// Ireland CSV editor (client-side)
exports.ireland_editor = async (req, res, next) => {
  try {
    const [taricMappings, taricExplanations] = await Promise.all([
      IrelandTaricMapping.findAll({
        order: [['uses', 'DESC'], ['updatedAt', 'DESC']],
      }),
      IrelandTaricExplanation.findAll({
        order: [['taricCode', 'ASC']],
      }),
    ]);
    res.render('hs_ireland_editor', {
      taricMappings: buildTaricMappingsForEditor(taricMappings, taricExplanations),
      trackingUpdated: Number(req.query.trackingUpdated || 0),
      trackingCreated: Number(req.query.trackingCreated || 0),
    });
  } catch (err) {
    next(err);
  }
};

exports.ireland_save_mappings = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const result = await saveIrelandTaricMappings(items);
    res.json({
      status: 'OK',
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      saved: result.saved,
    });
  } catch (err) {
    next(err);
  }
};

exports.ireland_save_work_summary = async (req, res, next) => {
  try {
    const summaries = Array.isArray(req.body.summaries) ? req.body.summaries : [];
    const result = await saveIrelandWorkSummaries(summaries);
    res.json({
      status: 'OK',
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      saved: result.saved,
    });
  } catch (err) {
    next(err);
  }
};

exports.ireland_save_tracking_numbers = async (req, res, next) => {
  try {
    const result = await saveIrelandTrackingNumbers(req.body.orderNumbers, req.body.trackingNumbers);
    res.redirect(`/hs/ireland?trackingUpdated=${result.updated}&trackingCreated=${result.created}`);
  } catch (err) {
    next(err);
  }
};

exports.ireland_taric_explanations = async (req, res, next) => {
  try {
    const [taricMappings, taricExplanations] = await Promise.all([
      IrelandTaricMapping.findAll({
        order: [['uses', 'DESC'], ['updatedAt', 'DESC']],
      }),
      IrelandTaricExplanation.findAll({
        order: [['taricCode', 'ASC']],
      }),
    ]);
    res.render('hs_ireland_taric_explanations', {
      entries: buildTaricExplanationRows(taricMappings, taricExplanations),
      saved: Number(req.query.saved || 0),
      deleted: Number(req.query.deleted || 0),
    });
  } catch (err) {
    next(err);
  }
};

exports.ireland_save_taric_explanations = async (req, res, next) => {
  try {
    const result = await saveIrelandTaricExplanations(req.body.taricCodes, req.body.explanations);
    res.redirect(`/hs/ireland/taric-explanations?saved=${result.saved}&deleted=${result.deleted}`);
  } catch (err) {
    next(err);
  }
};

exports.ireland_work_summary = async (req, res, next) => {
  try {
    const month = normalizeMonth(req.query.month);
    const entries = await IrelandWorkSummary.findAll({
      where: {
        addedDate: {
          [Op.like]: `${month}-%`,
        },
      },
      order: [['addedDate', 'ASC'], ['orderNumber', 'ASC']],
    });
    res.render('hs_ireland_work_summary', {
      month,
      entries,
      orderNumbersText: entries.map((entry) => entry.orderNumber).join('\n'),
      trackingNumbersText: entries.map((entry) => entry.trackingNumber || '').join('\n'),
    });
  } catch (err) {
    next(err);
  }
};

// Manual editor
exports.manual_edit = (req, res) => {
  HSCodeList.findAll().then(entries => {
    res.render('hs_manual_edit', { sections_lookup, headings_lookup, entries });
  });
};

// To easily verify the content of a file
exports.checker = (req, res) => {
  HSCodeList.findAll().then(entries => {
    res.render('hs_checker', { sections_lookup, headings_lookup, entries });
  });
};

// Database edit layout
exports.db_editor = (req, res) => {
  HSCodeList.findAll().then(entries => {
    const usage = {};
    entries.forEach(e => {
      if (e.code in usage) {
        usage[e.code] += e.uses;
      } else {
        usage[e.code] = e.uses;
      }
    });
    entries.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    res.render('hs_db_editor', { sections_lookup, headings_lookup, entries, usage });
  });
};

// Access as API endpoint
exports.db_update = (req, res) => {
  HSCodeList.update({code: req.body.newCode}, { where: { name: req.body.currName, code: req.body.currCode } });
  res.json({ status: "OK" });
};

exports.db_delete = (req, res) => {
  HSCodeList.destroy({ where: { id: req.body.id } });
  res.json({ status: "OK" });
};

exports.manifest_check = (req, res) => {
  res.render('manifest_check');
};
