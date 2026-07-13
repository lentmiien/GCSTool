const express = require('express');

const router = express.Router();
const controller = require('../controllers/ctController');

router.get('/', controller.dashboard);
router.post('/open', controller.openCase);

router.get('/case/:orderNumber', controller.caseDetail);
router.post('/case/:orderNumber', controller.updateCase);

router.get('/admin', controller.admin);
router.post('/admin/complaints', controller.addComplaintType);
router.post('/admin/complaints/:id', controller.updateComplaintType);
router.post('/admin/complaints/:id/delete', controller.deleteComplaintType);
router.post('/admin/shipping-methods', controller.addShippingMethod);
router.post('/admin/shipping-methods/:id/delete', controller.deleteShippingMethod);
router.post('/admin/solutions', controller.addSolutionType);
router.post('/admin/solutions/:id/delete', controller.deleteSolutionType);

router.get('/analytics', controller.analytics);
router.get('/analytics/item/:itemCode', controller.itemAnalytics);

module.exports = router;
