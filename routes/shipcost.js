// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/shipcostController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.use(controller.prepare);
router.get('/', controller.index);
router.get('/online', controller.online);
router.get('/history', controller.history);
router.post('/api/import', controller.importCsv);

router.post('/savetodb', controller.upload);

router.get('/view', controller.view);

// Export router
module.exports = router;
