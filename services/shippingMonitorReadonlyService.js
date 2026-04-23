const trackingMonitorService = require('./trackingMonitorService');

module.exports = {
  normalizeGroupIdList: trackingMonitorService.normalizeGroupIdList,
  listShortcuts: trackingMonitorService.listShortcuts,
  getGroupComparisonReport: trackingMonitorService.getGroupComparisonReport,
  getShortcutComparisonReport: trackingMonitorService.getShortcutComparisonReport,
};
