const { createController } = require('../controllers/japanPostController');

module.exports = service => {
  const router = require('express').Router();
  const controller = createController(service);
  router.use(controller.prepare);
  router.get('/', controller.index);
  router.get('/database', controller.database);
  router.post('/api/fetch', controller.fetch);
  router.get('/api/countries/:cid', controller.history);
  router.get('/api/schedules', controller.schedules);
  router.post('/api/schedules', controller.schedule);
  router.post('/api/schedules/:id/cancel', controller.cancel);
  return router;
};
