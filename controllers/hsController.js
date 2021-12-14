// Require used packages
const csv = require('csvtojson')

// Require necessary database models
const { HSCodeList } = require('../sequelize');
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
  res.json({ status: "OK" })
};
