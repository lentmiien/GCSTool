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

// For the orders with HS codes in separate file
router.get('/manualedit', controller.manual_edit);

// HS checker
router.get('/checker', controller.checker);

// Edit database
router.get('/dbeditor', controller.db_editor);
router.post('/dbupdate', controller.db_update);

// Export router
module.exports = router;
