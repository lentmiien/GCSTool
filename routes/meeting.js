var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/meetingController');

/* GET landing page. */
router.get('/', controller.meeting_landing);
router.post('/', controller.meeting_landing);

router.get('/new/:timestamp', controller.new);

router.post('/addfeedback', controller.addfeedback);
router.get('/feedback', controller.showfeedback);
router.post('/editfeedback', controller.editfeedback);
router.get('/editissue/:id', controller.editissue);
router.post('/editissue', controller.editissue_post);

module.exports = router;
