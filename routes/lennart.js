var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/lennartController');

// Endpoint access validator
router.all('*', controller.all);

/* GET landing page. */
router.get('/', controller.index);
router.get('/zpl', controller.zpl);
router.get('/host-samples', controller.hostSamples);
router.get('/host-trends', controller.hostTrends);
router.get('/daily-task-import', controller.dailyTaskImport);
router.post('/zpl', controller.convertZpl);
router.post('/daily-task-import', controller.importDailyTaskCsv);

router.post('/updateait', controller.updateait);

module.exports = router;
