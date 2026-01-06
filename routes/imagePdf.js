const express = require('express');

const router = express.Router();
const controller = require('../controllers/imagePdfController');

router.get('/', controller.index);
router.post('/generate', controller.generate);

module.exports = router;
