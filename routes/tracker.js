// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/trackerController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.index);
router.post('/getdata', controller.getdata);

// For adding tracking numbers to database
router.get('/generate', controller.generate);
router.post('/startTask', controller.start_upload_tracking);
router.get('/status/:taskId', controller.status_upload_tracking);

// Export router
module.exports = router;
