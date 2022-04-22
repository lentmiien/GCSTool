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

// Export router
module.exports = router;
