const cheerio = require('cheerio');

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span',
  'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]);
const DROP_WITH_CONTENT = new Set([
  'base', 'embed', 'form', 'iframe', 'input', 'link', 'math', 'meta', 'object',
  'script', 'style', 'svg', 'textarea', 'video',
]);
const GLOBAL_ATTRIBUTES = new Set(['class']);
const TAG_ATTRIBUTES = {
  a: new Set(['href', 'rel', 'target', 'title']),
  img: new Set(['alt', 'height', 'src', 'title', 'width']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
};
const SAFE_CLASS_PATTERN = /^(?:contains-task-list|language-[a-z0-9_-]+|task-list-item)$/i;

function isSafeUrl(value, allowMailto) {
  const url = String(value || '').trim();
  if (!url || url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true;
  }
  const normalizedForSchemeCheck = url.replace(/[\u0000-\u0020\u007f]+/g, '');
  const schemeMatch = normalizedForSchemeCheck.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    return true;
  }
  const scheme = schemeMatch[1].toLowerCase();
  return scheme === 'http' || scheme === 'https' || (allowMailto && (scheme === 'mailto' || scheme === 'tel'));
}

function sanitizeClassList(value) {
  return String(value || '')
    .split(/\s+/)
    .filter((className) => SAFE_CLASS_PATTERN.test(className))
    .join(' ');
}

function sanitizeHtml(input) {
  const $ = cheerio.load('<div id="gcs-sanitize-root"></div>', {
    decodeEntities: true,
  });
  const root = $('#gcs-sanitize-root');
  root.html(String(input || ''));

  root.find('script, style, iframe, object, embed, form, input, textarea, svg, math, link, meta, base, video').remove();

  root.find('*').toArray().forEach((node) => {
    const element = $(node);
    const tagName = String(node.name || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      if (DROP_WITH_CONTENT.has(tagName)) {
        element.remove();
      } else {
        element.replaceWith(element.contents());
      }
      return;
    }

    Object.keys(node.attribs || {}).forEach((attributeName) => {
      const normalizedName = attributeName.toLowerCase();
      const tagAllowed = TAG_ATTRIBUTES[tagName] && TAG_ATTRIBUTES[tagName].has(normalizedName);
      if (!GLOBAL_ATTRIBUTES.has(normalizedName) && !tagAllowed) {
        element.removeAttr(attributeName);
      }
    });

    if (element.attr('class')) {
      const safeClasses = sanitizeClassList(element.attr('class'));
      if (safeClasses) {
        element.attr('class', safeClasses);
      } else {
        element.removeAttr('class');
      }
    }

    if (tagName === 'a') {
      if (!isSafeUrl(element.attr('href'), true)) {
        element.removeAttr('href');
      }
      if (element.attr('target') !== '_blank') {
        element.removeAttr('target');
      } else {
        element.attr('rel', 'noopener noreferrer');
      }
    }

    if (tagName === 'img') {
      if (!isSafeUrl(element.attr('src'), false)) {
        element.remove();
      }
      for (const dimension of ['width', 'height']) {
        const value = element.attr(dimension);
        if (value && !/^\d{1,4}$/.test(value)) {
          element.removeAttr(dimension);
        }
      }
    }

    if (tagName === 'td' || tagName === 'th') {
      for (const spanAttribute of ['colspan', 'rowspan']) {
        const value = element.attr(spanAttribute);
        if (value && !/^\d{1,2}$/.test(value)) {
          element.removeAttr(spanAttribute);
        }
      }
    }
  });

  root.contents().filter(function () {
    return this.type === 'comment';
  }).remove();
  return root.html() || '';
}

module.exports = sanitizeHtml;
