const express = require('express');

const controller = require('../controllers/dailyTasksController');

const router = express.Router();

router.get('/', controller.index);
router.post('/assign', controller.assign);
router.post('/types', controller.createTaskType);
router.post('/types/:id/archive', controller.setTaskTypeArchived);

module.exports = router;
