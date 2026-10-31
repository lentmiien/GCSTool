const cheerio = require('cheerio');

const clean = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const quantity = (value, unit) => ({ value: Number(value), unit: unit.toLowerCase() });
const unavailableText = /(?:取(?:り)?扱(?:い)?なし|取り?扱わない|取り?扱いません|取扱不可)/;
const servicePaths = [['parcel', 'air', 'Parcel air'], ['parcel', 'surface', 'Parcel surface'], ['ems', null, 'EMS']];

function isUnavailable(service) {
  const weight = service.weight;
  return service.unavailable === true
    || Boolean(weight && typeof weight === 'object' && weight.value === 0 && ['kg', 'g'].includes(weight.unit))
    || [service.size, weight].some(value => typeof value === 'string' && unavailableText.test(clean(value)))
    || (typeof weight === 'string' && /^0(?:\.0+)?\s*(kg|g)(?:まで|以下|\s|$)/i.test(clean(weight)));
}

// Derive status for older cache records too, without refetching or rewriting history.
function normalizeCountry(data) {
  const result = { ...data, parcel: { ...data.parcel } };
  const unavailableLabels = [];
  for (const [group, method, label] of servicePaths) {
    const service = method ? data[group][method] : data[group];
    const normalized = { ...service, unavailable: isUnavailable(service) };
    if (method) result[group][method] = normalized;
    else result[group] = normalized;
    if (normalized.unavailable) unavailableLabels.push(label);
  }
  result.warnings = (data.warnings || []).filter(warning => !unavailableLabels.some(label =>
    warning === `${label}: some limits were not found. Check the source page.`
    || warning === `${label}: source text retained where numeric parsing was not possible.`));
  return result;
}

function countryNameFrom($, heading) {
  // Notices can precede the name. Stay in the heading's introductory block and
  // select the emphasized Latin name rather than assuming the first paragraph.
  const candidates = heading.nextUntil('div, h1, h2, h3').filter('p');
  const nameElement = candidates.filter((_, node) => $(node).find('strong').length && /[A-Za-z]/.test($(node).text())).first().clone();
  nameElement.find('br').replaceWith('\n');
  const lines = nameElement.text().split('\n').map(clean).filter(Boolean);
  const first = lines[0] || '';
  // The site appends a French gloss in parentheses, sometimes after a comma.
  // Keep geographical lists and English qualifications (including nested ones).
  const gloss = first.match(/,?\s*\(([^(),]+)\)$/);
  const stripGloss = gloss && !/\b(?:incl\.?|including|islands?|isls?\.?|territor\w*|rep\.?|republic|of|british|french|dutch)\b/i.test(gloss[1]);
  let name = stripGloss ? first.slice(0, gloss.index).trim() : first;
  if (stripGloss) {
    const territories = lines.slice(1).filter(line => /^\([A-Za-z .'-]+(?:,\s*[A-Za-z .'-]+)+\)$/.test(line));
    if (territories.length) name += ` ${territories.join(' ')}`;
  }
  return name;
}

function parseSize(text) {
  if (!text) return null;
  const compact = clean(text).replace(/\s/g, '');
  const match = compact.match(/^長さ(\d+(?:\.\d+)?)(cm|mm|m)長さと横周の合計(\d+(?:\.\d+)?)(cm|mm|m)(?:まで|以下)?$/i);
  if (!match) return clean(text);
  return { length: quantity(match[1], match[2]), lengthPlusGirth: quantity(match[3], match[4]) };
}

function parseWeight(text) {
  if (!text) return null;
  const match = clean(text).match(/^(\d+(?:\.\d+)?)\s*(kg|g)\s*(?:まで|以下)?$/i);
  return match ? quantity(match[1], match[2]) : clean(text);
}

// Expand rowspans so service and limit labels remain attached to their values.
function tableRows($, table) {
  const rows = [];
  $(table).find('tr').each((rowIndex, tr) => {
    const row = rows[rowIndex] || (rows[rowIndex] = []);
    let column = 0;
    $(tr).children('th, td').each((_, cell) => {
      while (row[column]) column++;
      const value = { text: clean($(cell).text()), cell };
      const height = Math.min(100, Number($(cell).attr('rowspan')) || 1);
      const width = Math.min(100, Number($(cell).attr('colspan')) || 1);
      for (let r = 0; r < height; r++) {
        const target = rows[rowIndex + r] || (rows[rowIndex + r] = []);
        for (let c = 0; c < width; c++) target[column + c] = value;
      }
      column += width;
    });
  });
  return rows;
}

function parseCountry(html) {
  const $ = cheerio.load(html);
  const heading = $('.cgi-kokusai h1').first();
  const countryName = countryNameFrom($, heading);
  const findSection = label => $('h2, h3').filter((_, node) => clean($(node).text()) === label).first();
  const parcelHeading = findSection('小包郵便物');
  const emsHeading = findSection('EMS郵便物');
  if (!countryName || !/[A-Za-z]/.test(countryName) || !parcelHeading.length || !emsHeading.length) {
    const error = new Error('Japan Post did not return a recognizable country page. Check the CID or try again later.');
    error.status = 502;
    throw error;
  }
  const warnings = [];
  function limits(section, method, label) {
    const contents = section.nextUntil('h2, h3');
    const values = { size: [], weight: [] };
    contents.find('table').each((_, table) => {
      if (!$(table).text().includes('大きさの最大限')) return;
      tableRows($, table).forEach(row => {
        if (method && !row.some(cell => cell.text === method)) return;
        const field = row.some(cell => cell.text === '大きさの最大限') ? 'size'
          : row.some(cell => cell.text === '重量') ? 'weight' : null;
        if (!field) return;
        const last = row[row.length - 1];
        if (last && last.text && !['重量', '大きさの最大限', method].includes(last.text)) values[field].push(last.text);
      });
    });
    const result = {
      size: parseSize([...new Set(values.size)].join(' ')),
      weight: parseWeight([...new Set(values.weight)].join(' ')),
    };
    result.unavailable = isUnavailable(result);
    if (!result.unavailable && (!result.size || !result.weight)) {
      warnings.push(`${label}: some limits were not found. Check the source page.`);
    }
    if (!result.unavailable && (typeof result.size === 'string' || typeof result.weight === 'string')) warnings.push(`${label}: source text retained where numeric parsing was not possible.`);
    return result;
  }
  return {
    countryName,
    parcel: { air: limits(parcelHeading, '航空便', 'Parcel air'), surface: limits(parcelHeading, '船便', 'Parcel surface') },
    ems: limits(emsHeading, null, 'EMS'),
    warnings,
  };
}

module.exports = { parseCountry, parseSize, parseWeight, normalizeCountry, isUnavailable };
