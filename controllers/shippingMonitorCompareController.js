const shippingMonitorReadonlyService = require('../services/shippingMonitorReadonlyService');

function createEmptyReport() {
  return {
    groups: [],
    summary: {},
    methodSections: [],
    uncachedGroups: [],
  };
}

exports.index = async function (req, res) {
  try {
    const shortcuts = await shippingMonitorReadonlyService.listShortcuts();
    res.render('shipping_monitor_shortcuts_index', {
      pagetitle: 'Shipping Monitor Compare',
      shortcuts,
      error: null,
    });
  } catch (error) {
    res.status(error.status || 500).render('shipping_monitor_shortcuts_index', {
      pagetitle: 'Shipping Monitor Compare',
      shortcuts: [],
      error: error.message || 'Failed to load shipping monitor shortcuts.',
    });
  }
};

exports.showShortcutCompare = async function (req, res) {
  try {
    const { shortcut, report } = await shippingMonitorReadonlyService.getShortcutComparisonReport(
      req.params.shortcutId
    );

    res.render('shipping_monitor_compare', {
      pagetitle: shortcut.label
        ? `Shipping Monitor Compare - ${shortcut.label}`
        : 'Shipping Monitor Compare',
      shortcut,
      report,
      error: null,
    });
  } catch (error) {
    res.status(error.status || 500).render('shipping_monitor_compare', {
      pagetitle: 'Shipping Monitor Compare',
      shortcut: null,
      report: createEmptyReport(),
      error: error.message || 'Failed to load the saved comparison report.',
    });
  }
};
