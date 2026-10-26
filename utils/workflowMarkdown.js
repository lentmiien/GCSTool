const marked = require('marked');
const cheerio = require('cheerio');
const sanitizeHtml = require('./sanitizeHtml');

// Use the same renderer for saved content and editor previews.
module.exports = function renderWorkflowMarkdown(source) {
  const html = sanitizeHtml(marked.parse(String(source || ''), { gfm: true, breaks: true }));
  const $ = cheerio.load(html, { decodeEntities: true });
  $('a[href]').attr('target', '_blank').attr('rel', 'noopener noreferrer');
  return $.html();
};
