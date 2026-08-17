(function () {
  'use strict';

  const STORAGE_KEY = 'gcs-color-mode';
  const DARK_STYLESHEET = 'Style_dark.css';
  const LIGHT_STYLESHEET = 'Style_normal.css';

  function normalizeMode(value) {
    if (value === 'light' || value === LIGHT_STYLESHEET) {
      return 'light';
    }
    if (value === 'dark' || value === DARK_STYLESHEET) {
      return 'dark';
    }
    return null;
  }

  function readLegacyMode() {
    try {
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      return settings && typeof settings === 'object' ? normalizeMode(settings.colormode) : null;
    } catch (_error) {
      return null;
    }
  }

  function getPreferredMode() {
    try {
      const savedMode = normalizeMode(localStorage.getItem(STORAGE_KEY));
      if (savedMode) {
        return savedMode;
      }
    } catch (_error) {
      // Storage can be unavailable in private or restricted browser contexts.
    }
    return readLegacyMode() || 'dark';
  }

  function updateLegacySettings(mode) {
    try {
      let settings = {};
      try {
        const parsed = JSON.parse(localStorage.getItem('settings') || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          settings = parsed;
        }
      } catch (_error) {
        settings = {};
      }
      settings.colormode = mode === 'dark' ? DARK_STYLESHEET : LIGHT_STYLESHEET;
      localStorage.setItem('settings', JSON.stringify(settings));
    } catch (_error) {
      // The visible theme should still work when persistence is unavailable.
    }
  }

  function updateControls(mode) {
    const toggle = document.getElementById('theme-toggle');
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    if (toggle) {
      toggle.setAttribute('aria-label', `Switch to ${nextMode} theme`);
      toggle.setAttribute('title', `Switch to ${nextMode} theme`);
      toggle.removeAttribute('aria-pressed');
    }

    const legacySelect = document.getElementById('cmode');
    if (legacySelect) {
      legacySelect.value = mode === 'dark' ? DARK_STYLESHEET : LIGHT_STYLESHEET;
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', mode === 'dark' ? '#101a21' : '#f3f7f8');
    }

    document.querySelectorAll('.toastui-editor-defaultUI').forEach((editor) => {
      editor.classList.toggle('toastui-editor-dark', mode === 'dark');
    });
  }

  function apply(mode, options) {
    const selectedMode = normalizeMode(mode) || 'dark';
    const shouldPersist = !options || options.persist !== false;

    document.documentElement.setAttribute('data-color-mode', selectedMode);
    document.documentElement.style.colorScheme = selectedMode;

    const stylesheet = document.getElementById('myCss');
    if (stylesheet) {
      stylesheet.href = `/stylesheets/${selectedMode === 'dark' ? DARK_STYLESHEET : LIGHT_STYLESHEET}`;
    }

    if (shouldPersist) {
      try {
        localStorage.setItem(STORAGE_KEY, selectedMode);
      } catch (_error) {
        // Keep the in-memory theme when persistence is unavailable.
      }
      updateLegacySettings(selectedMode);
    }

    updateControls(selectedMode);
    window.dispatchEvent(new CustomEvent('gcs:themechange', { detail: { mode: selectedMode } }));
    return selectedMode;
  }

  function toggle() {
    const currentMode = normalizeMode(document.documentElement.getAttribute('data-color-mode')) || 'dark';
    return apply(currentMode === 'dark' ? 'light' : 'dark');
  }

  window.GCSTheme = {
    apply,
    getPreferredMode,
    toggle,
  };

  apply(getPreferredMode(), { persist: false });
  document.addEventListener('DOMContentLoaded', function () {
    updateControls(normalizeMode(document.documentElement.getAttribute('data-color-mode')) || 'dark');
  });
})();
