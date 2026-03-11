// Require used packages
const csv = require('csvtojson');

// Require necessary database models
const { HSCodeList, IrelandTaricMapping, Op } = require('../sequelize');
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

const janPattern = /\(\s*JAN\s*([0-9]{8,14})\s*\)\s*$/i;

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function removeJanSuffix(value) {
  return collapseWhitespace(String(value || '').replace(/\s*\(\s*JAN\s*[0-9]{8,14}\s*\)\s*$/i, ' '));
}

function removeToyPrefix(value) {
  return collapseWhitespace(String(value || '').replace(/^toy\b[\s-]*/i, ' '));
}

function cleanIrelandItemName(value) {
  return removeToyPrefix(removeJanSuffix(value));
}

function normalizeIrelandItemName(value) {
  return cleanIrelandItemName(value).toLowerCase();
}

function sanitizeMappingCode(value) {
  return collapseWhitespace(value);
}

function extractJanCode(value) {
  const match = String(value || '').match(janPattern);
  return match ? match[1] : '';
}

async function saveIrelandTaricMappings(entries) {
  const janMappings = new Map();
  const nameMappings = new Map();

  entries.forEach((entry) => {
    const sourceHsCode = sanitizeMappingCode(entry.sourceHsCode);
    const taricCode = sanitizeMappingCode(entry.taricCode);
    const rawItemName = collapseWhitespace(entry.itemName);
    const itemName = cleanIrelandItemName(rawItemName);
    const itemNameNormalized = normalizeIrelandItemName(entry.itemNameNormalized || rawItemName);
    const janCode = sanitizeMappingCode(entry.janCode || extractJanCode(rawItemName));

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
      const itemKey = `${itemNameNormalized}__${sourceHsCode}`;
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

  const janCodes = Array.from(janMappings.keys());
  if (janCodes.length > 0) {
    const existingJanMappings = await IrelandTaricMapping.findAll({
      where: {
        mappingType: 'jan',
        janCode: {
          [Op.in]: janCodes,
        },
      },
    });
    const existingJanLookup = {};
    existingJanMappings.forEach((entry) => {
      existingJanLookup[entry.janCode] = entry;
    });

    for (const janCode of janCodes) {
      const mapping = janMappings.get(janCode);
      const existing = existingJanLookup[janCode];
      if (existing) {
        await IrelandTaricMapping.update({
          itemName: mapping.itemName,
          itemNameNormalized: mapping.itemNameNormalized,
          sourceHsCode: mapping.sourceHsCode,
          taricCode: mapping.taricCode,
          uses: existing.uses + mapping.uses,
        }, { where: { id: existing.id } });
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
    const existingNameMappings = await IrelandTaricMapping.findAll({
      where: {
        mappingType: 'name_hs',
        [Op.or]: nameKeys.map((itemKey) => {
          const mapping = nameMappings.get(itemKey);
          return {
            itemNameNormalized: mapping.itemNameNormalized,
            sourceHsCode: mapping.sourceHsCode,
          };
        }),
      },
    });
    const existingNameLookup = {};
    existingNameMappings.forEach((entry) => {
      existingNameLookup[`${entry.itemNameNormalized}__${entry.sourceHsCode}`] = entry;
    });

    for (const itemKey of nameKeys) {
      const mapping = nameMappings.get(itemKey);
      const existing = existingNameLookup[itemKey];
      if (existing) {
        await IrelandTaricMapping.update({
          itemName: mapping.itemName,
          taricCode: mapping.taricCode,
          uses: existing.uses + mapping.uses,
        }, { where: { id: existing.id } });
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
    const taricMappings = await IrelandTaricMapping.findAll({
      order: [['uses', 'DESC'], ['updatedAt', 'DESC']],
    });
    res.render('hs_ireland_editor', {
      taricMappings: taricMappings.map((entry) => entry.toJSON()),
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
      saved: result.saved,
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
