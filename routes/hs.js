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

// Ireland CSV editor
router.get('/ireland', controller.ireland_editor);
router.post('/ireland/amiami-items', controller.ireland_amiami_items);
router.post('/ireland/save-mappings', controller.ireland_save_mappings);
router.post('/ireland/save-work-summary', controller.ireland_save_work_summary);
router.post('/ireland/work-summary/tracking', controller.ireland_save_tracking_numbers);
router.get('/ireland/work-summary', controller.ireland_work_summary);
router.get('/ireland/taric-explanations', controller.ireland_taric_explanations);
router.post('/ireland/taric-explanations', controller.ireland_save_taric_explanations);

// For the orders with HS codes in separate file
router.get('/manualedit', controller.manual_edit);

// HS checker
router.get('/checker', controller.checker);

// Edit database
router.get('/dbeditor', controller.db_editor);
router.post('/dbupdate', controller.db_update);
router.post('/dbdelete', controller.db_delete);

// Manifest
router.get('/manifest_check', controller.manifest_check);

// Export router
module.exports = router;
