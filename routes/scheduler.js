var express = require('express');
var router = express.Router();

// Require controller modules.
var scheduler_controller = require('../controllers/schedulerController');

/// SCHEDULER ROUTES ///

// GET entry home page.
router.get('/', scheduler_controller.view);

// GET request for adding a national holiday to scheduler
router.get('/addholiday', scheduler_controller.add_holiday_get);

// POST request for adding a national holiday to scheduler
router.post('/addholiday', scheduler_controller.add_holiday_post);

// GET request for adding a day off or day to work for staff members in scheduler
router.get('/addschedule', scheduler_controller.add_schedule_get);

// POST request for adding a day off or day to work for staff members in scheduler
router.post('/addschedule', scheduler_controller.add_schedule_post);

// GET request for adding staff member to scheduler
router.get('/addstaff', scheduler_controller.add_staff_get);

// POST request for adding staff member to scheduler
router.post('/addstaff', scheduler_controller.add_staff_post);

// GET request for removing staff member from scheduler
router.get('/removestaff', scheduler_controller.remove_staff_get);

// POST request for removing staff member from scheduler
router.post('/removestaff', scheduler_controller.remove_staff_post);

// GET personal schedule
router.get('/:id/personal_schedule', scheduler_controller.display_personal_schedule);
// GET generate 1 year personal schedule
router.get('/:id/generate_personal_schedule', scheduler_controller.generate_personal_schedule);
// GET team schedule
router.get('/team_schedule', scheduler_controller.display_team_schedule);

module.exports = router;
