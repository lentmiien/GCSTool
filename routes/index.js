var express = require('express');
var router = express.Router();

// Require controller modules.
var index_controller = require('../controllers/indexController');

router.all('*', index_controller.all);

/* GET home page. */
router.get('/', index_controller.index);

router.get('/about', index_controller.about);

module.exports = router;
