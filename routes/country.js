// Require used packages
var express = require('express');
var router = express.Router();
const multer  = require('multer')
const upload = multer({ dest: './temp/' })

// Require controller modules
var controller = require('../controllers/countryController');

//-------------------------------------------//
// router.method(path, controller.endpoint); //
//-------------------------------------------//

router.get('/', controller.country);

router.get('/edit_country', controller.edit_country);
router.post('/update3166', upload.single('iso3166'), controller.update3166);
router.post('/update3166_api', controller.update3166_api);
router.post('/editamiamientry', controller.editamiamientry);
router.get('/checkjp', controller.checkjp);
router.post('/checkjp_update_notice', controller.checkjp_update_notice);
router.post('/checkjp_update_method', controller.checkjp_update_method);
router.post('/editfmentry', controller.editfmentry);
router.get('/fix_database', controller.fix_database);
router.post('/fix_database_update', controller.fix_database_update);
router.post('/transfer', upload.array('data'), controller.transfer);

// Export router
module.exports = router;
