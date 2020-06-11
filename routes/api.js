var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/apiController');

/* GET home page. */
router.get('/', controller.page);
router.get('/get_pdf', controller.get_pdf);

module.exports = router;
