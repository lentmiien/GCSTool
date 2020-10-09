var express = require('express');
var router = express.Router();

// Require controller modules.
var index_controller = require('../controllers/indexController');

router.all('*', index_controller.all);

/* GET home page. */
router.get('/', index_controller.index);

router.get('/timekeeper', index_controller.view_timekeeper);

router.get('/about', index_controller.about);

router.get('/admin', index_controller.admin_get);

router.post('/adduser', index_controller.adduser);

router.get('/reset_password/:id', index_controller.reset_password);
router.get('/make_admin/:id', index_controller.make_admin);
router.get('/make_user/:id', index_controller.make_user);

router.get('/removeuser/:userid', index_controller.removeuser);

module.exports = router;
