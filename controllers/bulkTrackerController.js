'use strict';

const bulkTrackingService = require('../services/bulkTrackingService');

function getUpload(req) {
  return req.files && req.files.trackingUpload
    ? req.files.trackingUpload
    : null;
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildChartPayload(report) {
  return {
    summary: report.summary || {},
    statusMix: report.statusMix || [],
    deliveredDurationStats: report.deliveredDurationStats || {},
    deliveredDurations: (report.shipments || [])
      .filter((shipment) => shipment.delivered && shipment.daysInShipment !== null)
      .map((shipment) => Number(shipment.daysInShipment)),
    countryDistribution: report.countryDistribution || [],
    methods: report.methods || [],
  };
}

function buildLandingNotice(query) {
  if (query.created) {
    const count = Number(query.created) || 0;
    return `Group created with ${count} shipment${count === 1 ? '' : 's'}. Its first analytics snapshot is ready.`;
  }
  if (query.archived) {
    return 'The group was archived and removed from the active list.';
  }
  if (query.restored) {
    return 'The group was restored and its analytics snapshot was refreshed.';
  }
  return '';
}

function buildDashboardNotice(query) {
  if (query.created) {
    const count = Number(query.created) || 0;
    return `Group created with ${count} shipment${count === 1 ? '' : 's'}.`;
  }
  if (query.added) {
    const addedCount = Number(query.added) || 0;
    const duplicateCount = Number(query.duplicates) || 0;
    const duplicateText = duplicateCount > 0
      ? ` ${duplicateCount} duplicate${duplicateCount === 1 ? ' was' : 's were'} skipped.`
      : '';
    return `${addedCount} shipment${addedCount === 1 ? ' was' : 's were'} added and the analytics snapshot was refreshed.${duplicateText}`;
  }
  if (query.restored) {
    return 'The group was restored and its analytics snapshot was refreshed.';
  }
  return '';
}

async function renderLanding(req, res, options = {}) {
  const landing = await bulkTrackingService.prepareLanding();
  return res.status(options.status || 200).render('bulk_tracking_index', {
    pagetitle: 'Bulk Tracking',
    ...landing,
    error: options.error || null,
    notice: options.notice || buildLandingNotice(req.query || {}),
    formData: options.formData || {},
  });
}

exports.index = async function (req, res, next) {
  try {
    const landing = await bulkTrackingService.prepareLanding();
    const openGroupId = Number(req.query.open);
    if (Number.isInteger(openGroupId) && openGroupId > 0) {
      const refreshFailed = landing.refreshErrors.some((error) => error.groupId === openGroupId);
      const targetExists = landing.groups.some((group) => group.id === openGroupId)
        || landing.autoArchivedGroupIds.includes(openGroupId);
      if (!refreshFailed && targetExists) {
        const query = new URLSearchParams();
        ['created', 'added', 'duplicates', 'restored'].forEach((key) => {
          if (req.query[key] !== undefined) {
            query.set(key, String(req.query[key]));
          }
        });
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return res.redirect(`/bulk-tracker/groups/${openGroupId}${suffix}`);
      }
    }

    return res.render('bulk_tracking_index', {
      pagetitle: 'Bulk Tracking',
      ...landing,
      error: null,
      notice: buildLandingNotice(req.query || {}),
      formData: {},
    });
  } catch (error) {
    return next(error);
  }
};

exports.createGroup = async function (req, res, next) {
  try {
    const result = await bulkTrackingService.createGroup({
      name: req.body.name,
      explanation: req.body.explanation,
      trackingInput: req.body.trackingInput,
      trackingUpload: getUpload(req),
      userId: req.user && req.user.userid,
    });
    return res.redirect(`/bulk-tracker?open=${result.group.id}&created=${result.addedCount}`);
  } catch (error) {
    if (error.status && error.status < 500) {
      try {
        return await renderLanding(req, res, {
          status: error.status,
          error: error.message,
          formData: {
            name: req.body.name || '',
            explanation: req.body.explanation || '',
            trackingInput: req.body.trackingInput || '',
          },
        });
      } catch (renderError) {
        return next(renderError);
      }
    }
    return next(error);
  }
};

exports.showDashboard = async function (req, res, next) {
  try {
    const dashboard = await bulkTrackingService.getDashboard(req.params.groupId);
    if (dashboard.needsLandingRefresh) {
      return res.redirect(`/bulk-tracker?open=${Number(req.params.groupId)}`);
    }
    if (!dashboard.report) {
      const error = new Error('This archived group has no readable analytics snapshot. Restore it to build a new one.');
      error.status = 500;
      throw error;
    }

    return res.render('bulk_tracking_dashboard', {
      pagetitle: `${dashboard.group.name} - Bulk Tracking`,
      ...dashboard,
      reportJson: safeJson(buildChartPayload(dashboard.report)),
      notice: buildDashboardNotice(req.query || {}),
      error: null,
    });
  } catch (error) {
    return next(error);
  }
};

exports.appendTracking = async function (req, res, next) {
  try {
    const result = await bulkTrackingService.appendTrackingNumbers(req.params.groupId, {
      trackingInput: req.body.trackingInput,
      trackingUpload: getUpload(req),
      userId: req.user && req.user.userid,
    });
    return res.redirect(
      `/bulk-tracker?open=${result.groupId}&added=${result.addedCount}&duplicates=${result.duplicateCount}`
    );
  } catch (error) {
    if (error.status && error.status < 500) {
      try {
        const dashboard = await bulkTrackingService.getDashboard(req.params.groupId);
        if (!dashboard.report) {
          return res.redirect(`/bulk-tracker?open=${Number(req.params.groupId)}`);
        }
        return res.status(error.status).render('bulk_tracking_dashboard', {
          pagetitle: `${dashboard.group.name} - Bulk Tracking`,
          ...dashboard,
          reportJson: safeJson(buildChartPayload(dashboard.report)),
          notice: '',
          error: error.message,
        });
      } catch (renderError) {
        return next(renderError);
      }
    }
    return next(error);
  }
};

exports.archiveGroup = async function (req, res, next) {
  try {
    await bulkTrackingService.archiveGroup(req.params.groupId);
    return res.redirect('/bulk-tracker?archived=1');
  } catch (error) {
    return next(error);
  }
};

exports.archived = async function (_req, res, next) {
  try {
    const groups = await bulkTrackingService.listArchivedGroups();
    return res.render('bulk_tracking_archived', {
      pagetitle: 'Archived Bulk Tracking Groups',
      groups,
      error: null,
    });
  } catch (error) {
    return next(error);
  }
};

exports.restoreGroup = async function (req, res, next) {
  try {
    const group = await bulkTrackingService.restoreGroup(req.params.groupId);
    return res.redirect(`/bulk-tracker?open=${group.id}&restored=1`);
  } catch (error) {
    return next(error);
  }
};
