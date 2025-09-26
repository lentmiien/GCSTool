const express = require('express');
const router = express.Router();

const controller = require('../controllers/ctController');

router.get('/', controller.dashboard);
router.post('/search', controller.search);

router.get('/case/new', controller.newCaseForm);
router.post('/case', controller.createCase);
router.get('/case/:id', controller.caseDetail);
router.post('/case/:id/update', controller.updateCase);
router.post('/case/:id/ticket', controller.addTicket);
router.post('/case/:id/comment', controller.addComment);
router.post('/case/:id/item', controller.upsertItem);
router.post('/case/:id/item/:itemId/delete', controller.deleteItem);
router.post('/case/:id/approve', controller.approveCase);
router.get('/case/:id/close/:action', controller.confirmClose);
router.post('/case/:id/close/:action', controller.closeCase);

router.get('/customer/:customerId', controller.customerProfile);
router.get('/items', controller.itemList);
router.get('/item/:item_code', controller.itemReport);
router.get('/audit', controller.viewAudit);

router.get('/deleteall', controller.deleteall);

module.exports = router;
