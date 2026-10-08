// Quoted phrases stay together; an unclosed quote extends to the end of the input.
module.exports = function parseSearchTerms(search) {
  if (typeof search !== 'string') return [];
  const terms = [];
  const pattern = /"([^"]*)"|"([^"]*)$|([^\s"]+)/g;
  let match;
  while ((match = pattern.exec(search)) !== null) {
    const term = (match[1] ?? match[2] ?? match[3]).trim();
    if (term) terms.push(term);
  }
  return terms;
};
