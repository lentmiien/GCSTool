var express = require('express');
var router = express.Router();

var controller = require('../controllers/bulkTrackerController');

router.get('/', controller.index);
router.get('/archived', controller.archived);
router.post('/groups', controller.createGroup);
router.get('/groups/:groupId', controller.showDashboard);
router.post('/groups/:groupId/shipments', controller.appendTracking);
router.post('/groups/:groupId/archive', controller.archiveGroup);
router.post('/groups/:groupId/restore', controller.restoreGroup);

module.exports = router;
