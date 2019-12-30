var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/meetingController');

/* GET landing page. */
router.get('/', controller.meeting_landing);
router.post('/', controller.meeting_landing);

module.exports = router;
