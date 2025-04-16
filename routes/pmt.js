var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/pmtController');

// router.all('*', controller.all);

/* GET home page. */
router.get('/', controller.top);
router.get('/create', controller.create);
router.post('/savenew', controller.savenew);

router.get('/reset', controller.delete_all);

module.exports = router;
