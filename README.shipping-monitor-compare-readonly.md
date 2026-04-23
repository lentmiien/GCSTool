# Shipping Monitor Compare View in Another Node.js App

This note explains how to recreate the `views/shipping_monitor_compare.pug` page in a second Node.js/Express app that uses the **same tracking database** as this app, but only in **read-only** mode.

The goal is:

- show existing saved shortcut links
- open a saved shortcut into the compare page
- reuse current cached data from the shared database
- avoid all cache writes and all other data updates

Because both apps point at the same database, any shortcut or cache updates made in this app will show up automatically in the other app. The second app does not need its own caching logic.

## What You Need

Copy these model files into the other app:

- `models/tracking.js`
- `models/trackingMonitorGroup.js`
- `models/trackingMonitorEntry.js`
- `models/trackingMonitorShortcut.js`

For the compare page itself, these are the important tables:

- `tracking_monitor_shortcuts`
- `tracking_monitor_groups`
- `tracking_monitor_entries`
- `tracking`

## What You Do Not Need

For a compare-only readonly app, you do **not** need:

- the individual group page
- cache refresh logic
- `trackhist0` to `trackhist4`
- manual outcome updates
- entry deletion
- group creation
- shortcut creation, rename, append, replace, or delete

## Important Read-Only Rule

In the second app:

- do **not** call `sequelize.sync()`
- do **not** call `create`, `update`, `destroy`, `bulkCreate`, or `upsert`
- do **not** update `lastViewedAt`
- do **not** call the group report flow from `getGroupReport()`

If possible, use a DB user with `SELECT` access only.

## Why The Compare View Is Safe To Reuse

The compare view already behaves as a read-only report:

- cached entries reuse `tracking_monitor_entries.cached*` fields
- uncached entries are treated as `in transit`
- uncached entries still read the shared `tracking` table so they can be placed into a shipping method bucket
- no cache is written when the compare report is generated

That means the readonly app only needs the compare-specific data path.

## Minimum Files To Copy

### Models

Copy these files as-is:

- `models/tracking.js`
- `models/trackingMonitorGroup.js`
- `models/trackingMonitorEntry.js`
- `models/trackingMonitorShortcut.js`

### Frontend Assets

Copy these files:

- `views/shipping_monitor_compare.pug`
- `public/js/shipping_monitor_compare.js`
- `public/css/shipping_monitor.css`

Notes:

- `shipping_monitor_compare.js` can be reused unchanged.
- The page uses D3 via `https://d3js.org/d3.v7.min.js`.
- The markup relies heavily on Bootstrap utility classes. The easiest path is to keep Bootstrap available in the second app too.

## Database Setup In The Other App

Create a separate tracking DB connection in the other app. Keep it read-only.

Example structure:

```js
// sequelize-track-readonly.js
const Sequelize = require('sequelize');

const TrackingModel = require('./models/tracking');
const TrackingMonitorGroupModel = require('./models/trackingMonitorGroup');
const TrackingMonitorEntryModel = require('./models/trackingMonitorEntry');
const TrackingMonitorShortcutModel = require('./models/trackingMonitorShortcut');

const sequelizeTrack = new Sequelize(
  process.env.DB_NAME_TRACK,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
  }
);

const Tracking = TrackingModel(sequelizeTrack, Sequelize);
const TrackingMonitorGroup = TrackingMonitorGroupModel(sequelizeTrack, Sequelize);
const TrackingMonitorEntry = TrackingMonitorEntryModel(sequelizeTrack, Sequelize);
const TrackingMonitorShortcut = TrackingMonitorShortcutModel(sequelizeTrack, Sequelize);

module.exports = {
  sequelizeTrack,
  Tracking,
  TrackingMonitorGroup,
  TrackingMonitorEntry,
  TrackingMonitorShortcut,
};
```

Do not add `sequelizeTrack.sync()`.

## Service Strategy

There are two reasonable ways to build the readonly service.

### Option 1: Fastest

Copy `services/trackingMonitorService.js` into the other app as something like:

- `services/shippingMonitorReadonlyService.js`

Then expose only:

- `listShortcuts()`
- `getShortcutComparisonReport()`
- `getGroupComparisonReport()`
- `normalizeGroupIdList()`

This is the fastest approach, but the copied file will still contain write-capable code you are choosing not to call.

### Option 2: Strict Read-Only

Create a smaller compare-only service that contains only the compare helpers and report builders.

At minimum, the compare-only service needs logic equivalent to:

- `normalizeTrackingValue()`
- `toTimestamp()`
- `isDeliveredTrackingRow()`
- `isDhlRow()`
- `formatShippingMethodName()`
- `buildReportSummary()`
- `buildMethodStats()`
- `buildOutcomeMix()`
- `buildComparisonRow()`
- `normalizeGroupIdList()`
- `loadTrackingRowsByNumber()`
- `chooseTrackingMatch()`
- `loadComparisonLiveMatches()`
- `buildGroupComparisonReport()`
- `buildComparisonSummary()`
- `buildMethodComparisonSections()`
- `listShortcuts()`
- `getGroupComparisonReport()`
- `getShortcutComparisonReport()`

For compare-only mode, you do **not** need the live-refresh code that:

- loads track history
- analyzes delivered history
- writes cached outcomes
- updates groups or entries

## Route Design

For a readonly app, these two routes are enough:

- `GET /shipping-monitor-shortcuts`
- `GET /shipping-monitor-shortcuts/:shortcutId`

Recommended behavior:

- `/shipping-monitor-shortcuts` lists saved shortcut links
- `/shipping-monitor-shortcuts/:shortcutId` renders the compare page for that shortcut

Example route wiring:

```js
const express = require('express');
const controller = require('../controllers/shippingMonitorReadonlyController');

const router = express.Router();

router.get('/shipping-monitor-shortcuts', controller.index);
router.get('/shipping-monitor-shortcuts/:shortcutId', controller.showShortcutCompare);

module.exports = router;
```

## Controller Shape

The controller only needs to read shortcuts and render the compare page.

Example:

```js
const shippingMonitorReadonlyService = require('../services/shippingMonitorReadonlyService');

exports.index = async (_req, res) => {
  const shortcuts = await shippingMonitorReadonlyService.listShortcuts();
  res.render('shipping_monitor_shortcuts_index', {
    pagetitle: 'Shipping monitor shortcuts',
    shortcuts,
  });
};

exports.showShortcutCompare = async (req, res) => {
  const { shortcut, report } = await shippingMonitorReadonlyService.getShortcutComparisonReport(
    req.params.shortcutId
  );

  res.render('shipping_monitor_compare', {
    pagetitle: 'Saved Group Comparison',
    shortcut,
    report,
    error: null,
  });
};
```

## Minimal Shortcut Index Page

If the second app only needs to open existing saved reports, keep the index page simple.

Example idea:

```pug
extends layout

block content
  .container.mt-4
    h1.mb-3 Shipping Monitor Shortcuts
    .list-group
      each shortcut in shortcuts
        a.list-group-item.list-group-item-action(
          href=`/shipping-monitor-shortcuts/${shortcut.id}`
        )
          .fw-semibold= shortcut.label
          .small.text-muted= shortcut.groups.map((group) => `#${group.selectionIndex} ${group.label}`).join(' -> ')
```

## Recreating The Compare Page

The easiest way is to copy `views/shipping_monitor_compare.pug` and make only small app-specific changes:

- change the top navigation buttons to routes that exist in the second app
- keep the `window.shippingMonitorCompareReport` payload
- keep the D3 script include
- keep the same `report` and `shortcut` object structure

The compare page expects:

```js
{
  shortcut: {
    id,
    label,
    groupCount,
    groups: [{ id, selectionIndex, label }]
  },
  report: {
    selectedGroupIds: [1, 2, 3],
    groups: [
      {
        id,
        label,
        note,
        selectionIndex,
        lastViewedAt,
        summary: {
          totalEntries,
          cachedEntryCount,
          uncachedEntryCount,
          destinationDeliveredEntries,
          returnDeliveredEntries,
          inTransitEntries,
          averageTransitDays,
          cachedCoveragePercent,
          chart: {
            comparableEntries,
            destinationPercent,
            returnPercent,
            inTransitPercent
          }
        },
        methodStats: []
      }
    ],
    summary: { ...same summary shape... },
    methodSections: [
      {
        grouplabel,
        shippingMethodName,
        points: [
          {
            groupId,
            groupLabel,
            selectionIndex,
            totalEntries,
            summary
          }
        ]
      }
    ],
    uncachedGroups: [
      { id, label, uncachedEntryCount, totalEntries }
    ]
  }
}
```

## Dark Mode

`public/js/shipping_monitor_compare.js` reads colors from CSS variables on `.shipping-monitor`. That means you can keep the JS unchanged and only replace the stylesheet values.

Create a dark-mode version of `shipping_monitor.css`, for example:

```css
.shipping-monitor {
  --shipping-monitor-color-destination: #67c587;
  --shipping-monitor-color-destination-line: #a8e2bc;
  --shipping-monitor-color-destination-soft: rgba(103, 197, 135, 0.14);
  --shipping-monitor-color-return: #e28782;
  --shipping-monitor-color-return-line: #f0b2ae;
  --shipping-monitor-color-return-soft: rgba(226, 135, 130, 0.14);
  --shipping-monitor-color-transit: #7ea3ff;
  --shipping-monitor-color-transit-line: #b7cbff;
  --shipping-monitor-color-transit-soft: rgba(126, 163, 255, 0.14);
  --shipping-monitor-chart-surface:
    linear-gradient(180deg, rgba(24, 30, 38, 0.98), rgba(17, 22, 29, 0.98));
  --shipping-monitor-chart-border: #304050;
  --shipping-monitor-grid-color: rgba(189, 208, 224, 0.14);
}

.shipping-monitor .card {
  background: #18202a;
  border: 1px solid #2d3a48;
  color: #e6edf3;
}

.shipping-monitor .text-muted,
.shipping-monitor .shipping-monitor-chart-label,
.shipping-monitor .shipping-monitor-grid text {
  color: #9fb1c1 !important;
  fill: #9fb1c1;
}

.shipping-monitor .table {
  color: #e6edf3;
}

.shipping-monitor .alert-light {
  background: #1b2530;
  border-color: #2d3a48;
  color: #d6e1ea;
}
```

If the second app already has a dark design system, use its tokens instead.

## Recommended Compare-Only Data Flow

The safest request flow in the second app is:

1. Read the shortcut row from `tracking_monitor_shortcuts`.
2. Parse `groupIds` in the saved order.
3. Load `tracking_monitor_groups` for those ids.
4. Load `tracking_monitor_entries` for those groups.
5. For entries with `cachedAt > 0`, reuse cached values directly.
6. For entries with `cachedAt <= 0`, read matching rows from `tracking`.
7. Treat any uncached entry as `in transit`.
8. Build the summary and method charts.
9. Render the compare page.

This matches the current compare-page contract without writing anything back.

## Validation Checklist

After wiring the second app:

1. Open a shortcut that already exists in this app.
2. Confirm the group order matches the saved shortcut order.
3. Confirm cached totals match this app's compare page.
4. Confirm uncached entries appear as `in transit`.
5. Confirm no `lastViewedAt` or `cached*` fields change after opening the page.
6. Confirm a shortcut added or edited in this app appears automatically in the second app.

## Suggested File Layout In The Other App

One clean layout would be:

- `models/tracking.js`
- `models/trackingMonitorGroup.js`
- `models/trackingMonitorEntry.js`
- `models/trackingMonitorShortcut.js`
- `db/sequelize-track-readonly.js`
- `services/shippingMonitorReadonlyService.js`
- `controllers/shippingMonitorReadonlyController.js`
- `routes/shippingMonitorReadonly.js`
- `views/shipping_monitor_shortcuts_index.pug`
- `views/shipping_monitor_compare.pug`
- `public/js/shipping_monitor_compare.js`
- `public/css/shipping_monitor_dark.css`

## Summary

To recreate the compare page in another Node.js app, you mainly need:

- the same tracking database
- the four Sequelize models listed above
- the compare-only report builder
- the compare Pug template
- the compare chart JS
- a dark-mode stylesheet

Keep the second app read-only, skip all sync and write paths, and the shared database will keep both apps in sync automatically.
