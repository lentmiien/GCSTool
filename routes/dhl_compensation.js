var express = require('express');
var router = express.Router();

var controller = require('../controllers/dhlCompensationController');

router.all('*', controller.all);

router.get('/', controller.index);
router.post('/create', controller.create);
router.post('/:id/estimate', controller.setEstimatedDate);
router.post('/:id/complete', controller.complete);

module.exports = router;
