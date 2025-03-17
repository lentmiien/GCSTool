var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/ctController');

router.all('*', controller.all);

/* GET home page. */
router.get('/', controller.ct);
router.get('/case/:id', controller.case);
router.get('/items', controller.item_top);
router.get('/item/:item_code', controller.item_report);
router.get('/refunds', controller.refund_top);
router.post('/process_refunds', controller.refund_process);
router.get('/audit', controller.view_audit);
router.get('/image/:filename', controller.get_image);

router.post('/newcase', controller.newcase);
router.post('/case/:id/comment', controller.comment);
router.post('/case/:id/ticket', controller.ticket);
router.post('/case/:id/record', controller.assistant_record);
router.post('/case/:id/add_item', controller.add_item);
router.post('/case/:id/add_refund', controller.add_refund);
router.post('/case/:id/cancel_refund', controller.cancel_refund);
router.post('/case/:id/take_case', controller.take_case);
router.post('/case/:id/deadline', controller.deadline);
router.post('/case/:id/type', controller.type);
router.post('/case/:id/status', controller.status);
router.post('/case/:id/solution', controller.solution);
router.post('/case/:id/cancel_reason', controller.cancel_reason);
router.get('/case/:id/complete', controller.complete);
router.get('/case/:id/cancel', controller.cancel);
router.get('/case/:id/nodeadline', controller.nodeadline);
router.get('/expire_files', controller.expire_files);

// For resetting database during testing
router.get('/delete_all', controller.delete_all);

module.exports = router;
