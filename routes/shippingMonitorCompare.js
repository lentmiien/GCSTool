var express = require('express');
var router = express.Router();

var controller = require('../controllers/shippingMonitorCompareController');

router.get('/', controller.index);
router.get('/:shortcutId', controller.showShortcutCompare);

module.exports = router;
