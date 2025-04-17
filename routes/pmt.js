var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/pmtController');

// router.all('*', controller.all);

/* GET home page. */
router.get('/', controller.top);
router.get('/create', controller.create);
router.post('/savenew', controller.savenew);
router.get('/details/:id', controller.details);
router.get('/edit/:id', controller.edit);
router.post('/editentry/:id', controller.editentry);
router.get('/logs', controller.logs);                  // all logs
router.get('/reviews', controller.reviews);            // only flagged‑for‑review
router.post('/log/:id/complete', controller.complete); // mark review as done

router.get('/reset', controller.delete_all);

module.exports = router;
