var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/pmtController');

// router.all('*', controller.all);

/* GET home page. */
router.get('/', controller.top);

module.exports = router;
