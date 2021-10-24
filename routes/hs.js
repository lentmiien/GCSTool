// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/hsController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.index);
router.post('/suggestions', controller.suggestions);
router.post('/previous', controller.previous);

// Export router
module.exports = router;
