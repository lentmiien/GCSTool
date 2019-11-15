var express = require('express');
var router = express.Router();

// Require controller modules.
var index_controller = require('../controllers/indexController');

router.all('*', index_controller.all);

/* GET home page. */
router.get('/', index_controller.index);

router.get('/about', index_controller.about);

router.get('/admin', index_controller.admin_get);

router.post('/adduser', index_controller.adduser);

router.get('/removeuser/:userid', index_controller.removeuser);

///// To be replaced by above 2 routes /////
router.get('/adminadd', index_controller.adminadd_get);

router.post('/adminadd', index_controller.adminadd_post);

router.get('/adminremove', index_controller.adminremove_get);

router.post('/adminremove', index_controller.adminremove_post);

//////// TEMPORARY ////////
router.get('/transferpersonal', index_controller.transferpersonal_get);
router.post('/transferpersonal', index_controller.transferpersonal_post);

module.exports = router;
