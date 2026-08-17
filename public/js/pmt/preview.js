(function () {
  'use strict';

  const allowedTags = new Set([
    'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'EM', 'H1', 'H2', 'H3',
    'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN',
    'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
  ]);
  const dangerousTags = new Set([
    'BASE', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'MATH', 'META', 'OBJECT',
    'SCRIPT', 'STYLE', 'SVG', 'TEXTAREA', 'VIDEO',
  ]);

  function safeUrl(value, allowMailto) {
    const url = String(value || '').trim();
    if (!url || url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return true;
    }
    const normalizedForSchemeCheck = url.replace(/[\u0000-\u0020\u007f]+/g, '');
    const match = normalizedForSchemeCheck.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!match) {
      return true;
    }
    const scheme = match[1].toLowerCase();
    return scheme === 'http' || scheme === 'https' || (allowMailto && (scheme === 'mailto' || scheme === 'tel'));
  }

  function sanitize(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    Array.from(template.content.querySelectorAll('*')).forEach((element) => {
      if (!allowedTags.has(element.tagName)) {
        if (dangerousTags.has(element.tagName)) {
          element.remove();
        } else {
          element.replaceWith(...Array.from(element.childNodes));
        }
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const allowed = (element.tagName === 'A' && ['href', 'rel', 'target', 'title'].includes(name))
          || (element.tagName === 'IMG' && ['alt', 'height', 'src', 'title', 'width'].includes(name))
          || (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan', 'scope'].includes(name));
        if (!allowed) {
          element.removeAttribute(attribute.name);
        }
      });

      if (element.tagName === 'A') {
        if (!safeUrl(element.getAttribute('href'), true)) {
          element.removeAttribute('href');
        }
        if (element.getAttribute('target') === '_blank') {
          element.setAttribute('rel', 'noopener noreferrer');
        } else {
          element.removeAttribute('target');
        }
      }
      if (element.tagName === 'IMG' && !safeUrl(element.getAttribute('src'), false)) {
        element.remove();
      }
    });
    return template.innerHTML;
  }

  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  window.GCSPmtPreview = {
    render(title, markdown) {
      return `<h5>${escapeHtml(title)}</h5><hr>${sanitize(marked.parse(String(markdown || '')))}`;
    },
  };
})();
