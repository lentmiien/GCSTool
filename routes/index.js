var express = require('express');
var router = express.Router();

// Require controller modules.
var index_controller = require('../controllers/indexController');
var app_settings_controller = require('../controllers/appSettingsController');

router.all('*', index_controller.all);

/* GET home page. */
router.get('/', index_controller.index);

router.get('/timekeeper', index_controller.view_timekeeper);

router.get('/about', index_controller.about);

router.get('/admin', index_controller.admin_get);

router.get('/admin/app-settings', app_settings_controller.index);
router.post('/admin/app-settings', app_settings_controller.create);
router.post('/admin/app-settings/:id', app_settings_controller.update);

router.post('/adduser', index_controller.adduser);

router.get('/change_name/:id/:name', index_controller.change_name);
router.get('/reset_password/:id', index_controller.reset_password);
router.get('/change_team/:id/:team', index_controller.change_team);
router.get('/make_admin/:id', index_controller.make_admin);
router.get('/make_user/:id', index_controller.make_user);

router.get('/removeuser/:userid', index_controller.removeuser);

module.exports = router;
