var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'GCS Tool' });
});

router.get('/about', function(req, res, next) {
  res.render('about', { title: 'GCS Tool' });
});

module.exports = router;
