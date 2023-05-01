var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/lennartController');

// Endpoint access validator
router.all('*', controller.all);

/* GET landing page. */
router.get('/', controller.index);

router.post('/updateait', controller.updateait);

module.exports = router;
