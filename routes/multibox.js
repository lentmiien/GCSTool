const express = require('express');
const controller = require('../controllers/multiBoxController');
const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!req.user) return res.status(401).json({ message: 'Sign in to use the multi-box packer.' });
  next();
});
router.get('/', controller.index);
router.get('/containers', controller.containers);
router.post('/jobs', controller.submit);
router.get('/jobs/:jobId', controller.job);
module.exports = router;
