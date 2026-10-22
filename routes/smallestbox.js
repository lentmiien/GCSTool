const express = require('express');
const controller = require('../controllers/smallestBoxController');
const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!req.user) return res.status(401).json({ success: false, message: 'Sign in to use the smallest box finder.' });
  next();
});
router.get('/', controller.index);
router.get('/containers', controller.containers);
router.post('/pack', controller.pack);

module.exports = router;
