const { createController } = require('../controllers/countryController');

module.exports = service => {
  const router = require('express').Router();
  const controller = createController(service);
  router.use(controller.prepare);
  router.get('/', controller.index);
  router.get('/countries', controller.index);
  router.get('/country/:countryCode', controller.details);
  router.get('/history', controller.history);
  router.get('/countryCodeEntryIdLink/manage', (req, res) => res.redirect('/country#source-mappings'));
  router.get('/updateHistory/:date', (req, res) => res.redirect('/country/history'));
  router.get('/country_csv_check', (req, res) => res.render('country_csv_check'));
  router.post('/api/:source/save', controller.save);
  router.post('/api/:source/import', controller.importCsv);
  router.post('/api/mappings/auto-map', controller.autoMap);
  router.post('/api/method-visibility', controller.saveMethodVisibility);
  return router;
};
