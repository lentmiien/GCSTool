var express = require('express');
var router = express.Router();

// Require controller module
var controller = require('../controllers/binpackController');

// All route, always run for every connection
router.all('*', controller.all);

// Packer app
router.get('/', controller.index);
router.get('/pack', controller.back);
router.post('/pack', controller.packbox);
router.get('/packboxes', controller.back);
router.post('/packboxes', controller.packboxes);

module.exports = router;
