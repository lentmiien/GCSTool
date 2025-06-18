var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/chatgptController');

/* GET home page. */
router.get('/', controller.index);
router.post('/', controller.send);

router.post('/generate', controller.generate);

// Other tools
router.get('/language_tools', controller.language_tools);
router.post('/language_tools/checked', controller.update_checked);
router.post('/language_tools/send', controller.language_send);

module.exports = router;
