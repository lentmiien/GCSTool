const router = require('express').Router();
const controller = require('../controllers/workflowController');

router.use(controller.prepare);
router.get('/', controller.tasks);
router.get('/history', controller.history);
router.get('/analytics', controller.analytics);
router.post('/preview', controller.preview);
router.get('/definitions', controller.definitions);
router.get('/definitions/new', controller.editor);
router.post('/definitions', controller.saveDefinition);
router.get('/definitions/:id', controller.definition);
router.get('/definitions/:id/edit', controller.editor);
router.post('/definitions/:id', controller.saveDefinition);
router.post('/definitions/:id/tasks/:stepId/membership', controller.membership);
router.post('/definitions/:id/start', controller.start);
router.get('/runs/:id', controller.run);
router.post('/runs/:id/tasks/:taskId', controller.act);
router.post('/runs/:id/variables', controller.variables);
router.post('/runs/:id/cancel', controller.cancel);

module.exports = router;
