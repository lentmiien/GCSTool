// Require used packages
var express = require('express');
var router = express.Router();

// Require controller modules
var controller = require('../controllers/shipcostController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.index);
