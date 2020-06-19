var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/apiController');

/* GET home page. */
router.get('/', controller.page);
router.get('/get_pdf_dhlreturn', controller.get_pdf_dhlreturn);
router.get('/get_pdf_dhltax', controller.get_pdf_dhltax);

module.exports = router;
