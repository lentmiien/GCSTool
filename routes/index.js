var express = require('express');
var router = express.Router();

// Require controller modules.
var index_controller = require('../controllers/indexController');

router.all('*', index_controller.all);

/* GET home page. */
router.get('/', index_controller.index);

router.get('/about', index_controller.about);

router.get('/admin', index_controller.admin_get);

router.get('/adminadd', index_controller.adminadd_get);

router.post('/adminadd', index_controller.adminadd_post);

router.get('/adminremove', index_controller.adminremove_get);

router.post('/adminremove', index_controller.adminremove_post);

module.exports = router;
