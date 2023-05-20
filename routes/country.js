// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/countryController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.country);

// Export router
module.exports = router;
