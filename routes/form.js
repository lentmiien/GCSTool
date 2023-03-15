var express = require('express');
var router = express.Router();

// Require controller modules.
var controller = require('../controllers/formController');

/* GET home page. */
router.get('/', controller.index);
router.post('/add', controller.add_post);
router.get('/csv', controller.fetch_data);
router.get('/delete/:id', controller.delete);

module.exports = router;
