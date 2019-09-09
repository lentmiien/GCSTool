var express = require('express');
var router = express.Router();

// Require controller modules.
var scheduler_controller = require('../controllers/schedulerController');

/// SCHEDULER ROUTES ///

// GET entry home page.
router.get('/', scheduler_controller.index);

// // GET request for creating a entry. NOTE This must come before routes that display Book (uses id).
// router.get('/create', entry_controller.entry_create_get);

// // POST request for creating entry.
// router.post('/create', entry_controller.entry_create_post);

// // GET request to delete entry.
// router.get('/:id/delete', entry_controller.entry_delete_get);

// // POST request to delete entry.
// router.post('/:id/delete', entry_controller.entry_delete_post);

// // GET request to update entry.
// router.get('/:id/update', entry_controller.entry_update_get);

// // POST request to update entry.
// router.post('/:id/update', entry_controller.entry_update_post);

module.exports = router;
