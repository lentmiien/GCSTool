var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/chatgptController');

/* GET home page. */
router.get('/', controller.index);
router.post('/', controller.send);

router.post('/generate', controller.generate);

module.exports = router;
