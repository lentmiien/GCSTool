// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/shipcostController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.index);

router.post('/savetodb', controller.upload);

router.get('/view', controller.view);

// Export router
module.exports = router;
