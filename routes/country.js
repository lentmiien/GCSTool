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

router.get('/', controller.index);

// OfficialCountryList
router.post('/officialCountryList/upload', upload.single('officialCountryList'), controller.officialCountryList_upload);

// InternalCountryList
router.post('/internalCountryList/upload', upload.single('internalCountryList'), controller.internalCountryList_upload);

// JapanPostCountryList
router.post('/japanPostCountryList/update', controller.japanPostCountryList_update);

// CountryCodeEntryIdLink
router.get('/countryCodeEntryIdLink/manage', controller.countryCodeEntryIdLink_manage);
router.post('/countryCodeEntryIdLink/add', controller.countryCodeEntryIdLink_add);
router.post('/countryCodeEntryIdLink/update/:countryCode', controller.countryCodeEntryIdLink_update);// TODO at some later time
router.post('/countryCodeEntryIdLink/delete/:countryCode', controller.countryCodeEntryIdLink_delete);// TODO at some later time

// Combined Functionality
router.get('/countries', controller.countries);
router.get('/country/:countryCode', controller.country);
router.get('/updateHistory/:date', controller.updateHistory);

// Search Functionality
// router.get('/search/:keyword', controller);

// Check shipping method CSV file
router.get('/country_csv_check', controller.country_csv_check);

// Export router
module.exports = router;
