const { createController } = require('../controllers/japanPostController');

module.exports = service => {
  const router = require('express').Router();
  const controller = createController(service);
  router.use(controller.prepare);
  router.get('/', controller.index);
  router.get('/database', controller.database);
  router.get('/countries/:code', controller.details);
  router.post('/api/import', controller.importCsv);
  router.get('/api/countries/:code', controller.history);
  return router;
};
