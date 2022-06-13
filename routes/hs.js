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

// Version 2
router.get('/v2', controller.index_v2);

// Export router
module.exports = router;
