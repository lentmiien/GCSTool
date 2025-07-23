const path = require('path');
const CaseTrackerService = require('../services/caseTracker');
const ct = new CaseTrackerService();

exports.all = async (req, res, next) => {
  // Setup globals for this module

  const d = new Date();
  res.locals.today = `${d.getFullYear()}-${d.getMonth() > 8 ? (d.getMonth() + 1) : "0" + (d.getMonth() + 1)}-${d.getDate() > 9 ? d.getDate() : "0" + d.getDate()}`;

  // Select values - TODO: transfer to database
  res.locals.claim_types = ["Defect", "Lost or Stuck in shipment", "Damaged in shipment", "Not received but appears delivered", "Delivered but missing content", "Delivered but wrong content", "Return reason", "Other"];
  res.locals.claim_statuses = ["Created", "Confirming issue with customer", "Confirmed issue, confirming solution", "Investigating with shipping company", "Offered solution to customer", "Processing replacement", "Processing return", "Processing refund", "Pending completion", "Completed", "Pending cancellation", "Canceled"];
  res.locals.claim_solutions = ["Exchange", "Return for refund", "Send replacement", "Compensation", "Refund missing items", "Delivered", "Assistance no longer needed"];
  res.locals.claim_cancel_reasons = ["No response", "Customer solved problem", "Rejected customer claim"];
  res.locals.shipping_methods = ["DHL", "EMS", "Air Parcel", "Air Small Packet Reg.", "Air Small Packet Unreg.", "Surface Parcel", "Surface Mail Premium", "ECMS", "Domestic"];
  res.locals.record_types = ["Replacement", "Return", "Original", "Mix-up"];
  res.locals.record_statuses = ["Created", "Confirmed", "Awaiting shipment", "Shipped", "Delivered", "Lost", "Canceled"];
  res.locals.refund_types = ["Return shipping", "Return for refund", "Tax compensation", "VAT or GST refund", "Pre-owned compensation", "Refund missing item", "JP compensation", "DHL compensation", "AIT compensation", "Returned goods", "Returned goods with return fee", "AmiAmi refund", "AmiAmi compensation"];
  res.locals.refund_statuses = ["Requested", "Processed", "Pending acceptance", "Pending processing", "Completed", "Completed (pending)", "Canceled (correction)", "Canceled", "Expired", "Rejected"];
  res.locals.refund_methods = ["PayPal", "AmiAmi points", "Credit Card", "Unionpay", "Bank transfer", "Pre-paid Label", "Customer Paid"];

  // Auto-complete values - TODO: transfer to database *Not urgent
  res.locals.ac_currencies = ["JPY", "USD", "EUR", "KRW", "MXN", "DKK", "GBP", "AUD", "NZD", "SGD", "ILS", "CAD", "TWD", "CNY", "RUB", "CHF", "KWD", "PHP", "HKD", "THB", "MYR", "KHR", "CLP", "NOK", "QAR", "TRY", "PLN", "SEK", "CZK", "BND", "NTD", "ARS", "UAH", "SAR", "VND", "IDR", "INR", "FJD", "BYN", "ZAR", "AED", "RSD", "BGN", "HUF", "PEN", "RON", "BRL", "XPF", "COP"];
  res.locals.ac_countries = [
    "AFGHANISTAN",
    "Aland Islands",
    "ALBANIA",
    "ALGERIA",
    "AMERICAN SAMOA",
    "ANDORRA",
    "ANGOLA",
    "ANGUILLA",
    "ANTARCTICA",
    "ANTIGUA AND BARBUDA",
    "ARGENTINA",
    "ARMENIA",
    "ARUBA",
    "AUSTRALIA",
    "AUSTRIA",
    "AZERBAIJAN",
    "BAHAMAS",
    "BAHRAIN",
    "BANGLADESH",
    "BARBADOS",
    "BELARUS",
    "BELGIUM",
    "BELIZE",
    "BENIN",
    "BERMUDA",
    "BHUTAN",
    "BOLIVIA",
    "Bonnaire, Sint Eustatius and Saba",
    "BOSNIA AND HERZEGOVINA",
    "BOTSWANA",
    "BOUVET ISLAND",
    "BRAZIL",
    "BRITISH INDIAN OCEAN TERRITORY",
    "BRUNEI DARUSSALAM",
    "BULGARIA",
    "BURKINA FASO",
    "BURUNDI",
    "CAMBODIA",
    "CAMEROON",
    "CANADA",
    "CAPE VERDE",
    "CAYMAN ISLANDS",
    "CENTRAL AFRICAN REPUBLIC",
    "CHAD",
    "CHILE",
    "CHINA",
    "CHRISTMAS ISLAND",
    "COCOS (KEELING) ISLANDS",
    "COLOMBIA",
    "COMOROS",
    "CONGO",
    "COOK ISLANDS",
    "COSTA RICA",
    "COTE D'IVOIRE",
    "CROATIA",
    "CUBA",
    "Curacao",
    "CYPRUS",
    "CZECH REPUBLIC",
    "DENMARK",
    "DJIBOUTI",
    "DOMINICA",
    "DOMINICAN REPUBLIC",
    "EAST TIMOR",
    "ECUADOR",
    "EGYPT",
    "EL SALVADOR",
    "EQUATORIAL GUINEA",
    "ERITREA",
    "ESTONIA",
    "ETHIOPIA",
    "FALKLAND ISLAND (MALVINAS)",
    "FAROE ISLANDS",
    "FIJI",
    "FINLAND",
    "FRANCE",
    "FRENCH GUIANA",
    "FRENCH POLYNESIA",
    "FRENCH SOUTHERN TERRITORIES",
    "GABON",
    "GAMBIA",
    "GEORGIA",
    "GERMANY",
    "GHANA",
    "GIBRALTAR",
    "GREECE",
    "GREENLAND",
    "GRENADA",
    "GUADELOUPE",
    "GUAM",
    "GUATEMALA",
    "Guernsey",
    "GUINEA",
    "GUINEA-BISSAU",
    "GUYANA",
    "HAITI",
    "HEARD ISLAND AND MCDONALD ISLANDS",
    "HONDURAS",
    "HONG KONG",
    "HUNGARY",
    "ICELAND",
    "INDIA",
    "INDONESIA",
    "IRAN (ISLAMIC REPUBLIC OF)",
    "IRAQ",
    "IRELAND",
    "Isle of Man",
    "ISRAEL",
    "ITALY",
    "JAMAICA",
    "JAPAN",
    "JORDAN",
    "KAZAKHSTAN",
    "KENYA",
    "KIRIBATI",
    "KOREA",
    "Korea, Republic of",
    "KUWAIT",
    "KYRGYZSTAN",
    "LAO PEOPLE'S DEMOCRATIC REPUBLIC",
    "LATVIA",
    "LEBANON",
    "LESOTHO",
    "LIBERIA",
    "LIBYAN ARAB JAMAHIRIYA",
    "LIECHTENSTEIN",
    "LITHUANIA",
    "LUXEMBOURG",
    "MACAU",
    "Macedonia, the former Yugoslav Republic of",
    "MADAGASCAR",
    "MALAWI",
    "MALAYSIA",
    "MALDIVES",
    "MALI",
    "MALTA",
    "MARSHALL ISLANDS",
    "MARTINIQUE",
    "MAURITANIA",
    "MAURITIUS",
    "MAYOTTE",
    "MEXICO",
    "MICRONESIA (FEDERATED STATES OF)",
    "Moldova, Republic of",
    "MONACO",
    "MONGOLIA",
    "MONTENEGRO",
    "MONTSERRAT",
    "MOROCCO",
    "MOZAMBIQUE",
    "MYANMAR",
    "NAMIBIA",
    "NAURU",
    "NEPAL",
    "NETHERLANDS",
    "NETHERLANDS ANTILLES",
    "NEW CALEDONIA",
    "NEW ZEALAND",
    "NICARAGUA",
    "NIGER",
    "NIGERIA",
    "NIUE",
    "NORFOLK ISLAND",
    "NORTHERN MARIANA ISLANDS",
    "NORWAY",
    "OMAN",
    "PAKISTAN",
    "PALAU",
    "PANAMA",
    "PAPUA NEW GUINEA",
    "PARAGUAY",
    "PERU",
    "PHILIPPINES",
    "PITCAIRN",
    "POLAND",
    "PORTUGAL",
    "PUERTO RICO",
    "QATAR",
    "REUNION",
    "ROMANIA",
    "RUSSIAN FEDERATION",
    "RWANDA",
    "SAINT HELENA",
    "SAINT KITTS AND NEVIS",
    "SAINT LUCIA",
    "SAINT PIERRE AND MIQUELON",
    "SAINT VINCENT AND THE GRENADINES",
    "SAMOA",
    "SAN MARINO",
    "SAO TOME AND PRINCIPE",
    "SAUDI ARABIA",
    "SENEGAL",
    "SERBIA",
    "SEYCHELLES",
    "SIERRA LEONE",
    "SINGAPORE",
    "Sint Maarten",
    "SLOVAKIA",
    "SLOVENIA",
    "SOLOMON ISLANDS",
    "SOMALIA",
    "SOUTH AFRICA",
    "SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS",
    "SOUTH SUDAN",
    "SPAIN",
    "SRI LANKA",
    "SUDAN",
    "SURINAME",
    "SVALBARD AND JAN MAYEN",
    "SWAZILAND",
    "SWEDEN",
    "SWITZERLAND",
    "SYRIAN ARAB REPUBLIC",
    "TAIWAN",
    "TAJIKISTAN",
    "TANZANIA",
    "THAILAND",
    "TOGO",
    "TOKELAU",
    "TONGA",
    "TRINIDAD AND TOBAGO",
    "TUNISIA",
    "TURKEY",
    "TURKMENISTAN",
    "TURKS AND CAICOS ISLANDS",
    "TUVALU",
    "UGANDA",
    "UKRAINE",
    "UNITED ARAB EMIRATES",
    "UNITED KINGDOM",
    "UNITED STATES",
    "UNITED STATES MINOR OUTLYING ISLANDS",
    "URUGUAY",
    "UZBEKISTAN",
    "VANUATU",
    "VATICAN CITY STATE (HOLY SEE)",
    "VENEZUELA",
    "VIET NAM",
    "VIRGIN ISLANDS (BRITISH )",
    "VIRGIN ISLANDS (U.S.)",
    "WALLIS AND FUTUNA ISLANDS",
    "WESTERN SAHARA",
    "YEMEN",
    "YUGOSLAVIA",
    "ZAIRE",
    "ZAMBIA",
    "ZIMBABWE",
  ];

  next();
};

exports.ct = async (req, res) => {
  const {order_numbers, case_numbers} = await ct.FetchAllOrderNumbers();
  const cases_details = await ct.FetchOngoingCases();
  // Sort by deadline
  cases_details.sort((a,b) => {
    if (a.deadline < b.deadline) return -1;
    if (a.deadline > b.deadline) return 1;
    return 0;
  });
  // const staff = req.user && req.user.userid ? req.user.userid : "Guest";
  // const todos = await ct.CreateToDoList(null, staff);
  res.render("ct/ct", {order_numbers, case_numbers, cases_details, todos: {}});
};

exports.case = async (req, res) => {
  try {
    const case_id = parseInt(req.params.id);
    const case_details = await ct.FetchCase(case_id);
    const todos = await ct.CreateToDoList(case_id, null);
    const existing_orders = [case_details.order];
    const staff = req.user && req.user.userid ? req.user.userid : "Guest";
    case_details.assistant_records.forEach(d => existing_orders.push(d.order));
    
    // "Pending completion", "Completed", "Pending cancellation", "Canceled"
    // If "Pending ..." and no todos Completed/Canceled case
    if (case_details.status.indexOf("Pending c") === 0 && todos[case_id].length === 0) {
      const newStatus = case_details.status === "Pending completion" ? "Completed" : "Canceled";
      await ct.SetStatus(case_id, newStatus, staff);
      res.redirect(`/ct/case/${case_id}`);
    } else {
      const userProfile = await ct.FetchUserProfile(case_details.customer_id);
      res.render("ct/case", {case_details, todolist: todos[case_id], existing_orders, userProfile});
    }
  } catch (error) {
    console.error('Error occurred:', error); // Log the error for debugging
    return res.redirect('/ct'); // Redirect to "/ct" in case of an error
  }
};

exports.item_top = async (req, res) => {
  const itemArray = await ct.FetchAllItems();
  res.render("ct/items", {itemArray});
};

exports.item_report = async (req, res) => {
  const itemCode = req.params.item_code;
  const {items, fileMap} = await ct.FetchItemDetails(itemCode);
  res.render("ct/item", {itemCode, items, fileMap});
};

exports.refund_top = async (req, res) => {
  const {refunds, fileMap} = await ct.FetchAllRefunds();
  res.render("ct/refunds", {refunds, fileMap});
};

exports.refund_process = async (req, res) => {
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";
  const keys = Object.keys(req.body);
  const inputs = [];
  const inputs_index = [];
  keys.forEach(key => {
    const parts = key.split('__');
    const id = parseInt(parts[1]);
    const index = inputs_index.indexOf(id);
    const type = parts[2];
    const value = req.body[key];
    if (index >= 0) {
      inputs[index][type] = value;
    } else {
      inputs_index.push(id);
      inputs.push({id, [type]: value});
    }
  });
  await ct.BatchUpdateRefunds(inputs, staff);
  res.redirect("/ct/refunds");
};

exports.newcase = async (req, res) => {
  const order = parseInt(req.body.newcase_ordernumber);
  const customer_id = req.body.newcase_customerid;
  const tracking = req.body.newcase_trackingnumber;
  const shipping_method = req.body.newcase_shippingmethod;
  const shipped_date = new Date(req.body.newcase_shippeddate);
  const type = req.body.newcase_type;
  const country = req.body.newcase_country;
  const now = new Date();
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 0, 0, 0, 0);
  const staff_in_charge = req.user && req.user.userid ? req.user.userid : "Guest";
  const status = req.body.newcase_status;
  const id = await ct.AddCase(order, customer_id, tracking, shipping_method, shipped_date, type, country, deadline, staff_in_charge, status);

  const comment = req.body.newcase_comment;
  await ct.AddComment(id, staff_in_charge, comment);

  for (let i = 1; req.body[`item${i}_code`] && req.body[`item${i}_code`].length > 0; i++) {
    const dummy_item_id = -1;//Guarantee to generate a new item
    const item_code = req.body[`item${i}_code`];
    const defect = req.body[`item${i}_issue`];
    const item_cost = parseInt(req.body[`item${i}_cost`]);
    let file_id = null;
    if (req.files && req.files[`item${i}_image`]) {
      const ftype = "defect";
      const filename = `defect_${Date.now()}_${req.files[`item${i}_image`].name}`;
      file_id = await ct.AddFile(id, ftype, filename, staff_in_charge, req.files[`item${i}_image`]);
    }
    await ct.AddItem(dummy_item_id, id, file_id, item_code, defect, item_cost, staff_in_charge);
  }

  if (req.body.newcase_ticket && req.body.newcase_ticket.length > 0) {
    const ticket = parseInt(req.body.newcase_ticket);
    await ct.AddTicket(id, ticket, staff_in_charge);
  }

  res.redirect(`/ct/case/${id}`);
};

exports.assistant_record = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const order = parseInt(req.body.record_order);
  const tracking = req.body.record_tracking;
  const type = req.body.record_type;
  const item_cost = parseInt(req.body.record_item);
  const shipping_cost = parseInt(req.body.record_shipping === "" ? 0 : req.body.record_shipping);
  const gst_cost = parseInt(req.body.record_gst === "" ? 0 : req.body.record_gst);
  const status = req.body.record_status;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetAssistantRecord(case_id, order, tracking, type, item_cost, shipping_cost, gst_cost, status, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.add_item = async (req, res) => {
  const id = req.body.item_item_id && req.body.item_item_id.length > 0 ? parseInt(req.body.item_item_id) : -1;//-1 for generating new item
  const case_id = parseInt(req.params.id);
  const item_code = req.body.item_item_code;
  const defect = req.body.item_defect;
  const item_cost = parseInt(req.body.item_item_cost);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";
  let file_id = null;
  if (req.files && req.files[`item_image`]) {
    const ftype = "defect";
    const filename = `defect_${Date.now()}_${req.files[`item_image`].name}`;
    file_id = await ct.AddFile(case_id, ftype, filename, staff, req.files[`item_image`]);
  }
  await ct.AddItem(id, case_id, file_id, item_code, defect, item_cost, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.add_refund = async (req, res) => {
  const id = req.body.refund_id && req.body.refund_id.length > 0 ? parseInt(req.body.refund_id) : -1;
  const case_id = parseInt(req.params.id);
  const order = parseInt(req.body.refund_order);
  const type = req.body.refund_type;
  const amount = parseFloat(req.body.refund_amount);
  const currency = req.body.refund_currency && req.body.refund_currency.length > 0 ? req.body.refund_currency : "JPY";
  const jpy_amount = req.body.refund_amount_jpy && req.body.refund_amount_jpy.length > 0 ? parseInt(req.body.refund_amount_jpy) : amount;
  const method = req.body.refund_method;
  const status = (method === "Pre-paid Label" || method === "Customer Paid") ? "Completed" : "Requested"; // "Pre-paid Label", "Customer Paid" -> auto-complete
  const refund_details = req.body.refund_details;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  let file_id = null;
  if (req.files && req.files[`refund_receipt`]) {
    const ftype = "receipt";
    const filename = `receipt_${Date.now()}_${req.files[`refund_receipt`].name}`;
    file_id = await ct.AddFile(case_id, ftype, filename, staff, req.files[`refund_receipt`]);
  }

  await ct.AddRefund(id, case_id, file_id, order, type, amount, currency, jpy_amount, status, method, refund_details, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.cancel_refund = async (req, res) => {
  const id = parseInt(req.body.id);
  const case_id = parseInt(req.params.id);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.CancelRefund(id, case_id, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.comment = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";
  const comment = req.body.comment;

  await ct.AddComment(case_id, staff, comment);

  res.redirect(`/ct/case/${case_id}`);
};

exports.ticket = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const ticket = parseInt(req.body.ticket);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.AddTicket(case_id, ticket, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.view_audit = async (req, res) => {
  const cutoff = new Date(Date.now() - (1000*60*60*24*30));
  const audit = (await ct.FetchAudit()).filter(d => d.timestamp > cutoff).reverse();
  res.render("ct/audit", {audit});
};

exports.get_image = async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "..", "data", "case", filename);
  res.sendFile(filePath);
};

exports.take_case = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.TakeCase(case_id, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.deadline = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const deadline = new Date(req.body.new_deadline);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetDeadline(case_id, deadline, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.type = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const type = req.body.new_type;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetType(case_id, type, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.status = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const status = req.body.new_status;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetStatus(case_id, status, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.solution = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const solution = req.body.new_solution;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetSolution(case_id, solution, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.cancel_reason = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const cancel_reason = req.body.new_cancel_reason;
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetCancelReason(case_id, cancel_reason, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.complete = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const status = "Pending completion";
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetStatus(case_id, status, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.cancel = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const status = "Pending cancellation";
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetStatus(case_id, status, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.nodeadline = async (req, res) => {
  const case_id = parseInt(req.params.id);
  const staff = req.user && req.user.userid ? req.user.userid : "Guest";

  await ct.SetDeadline(case_id, null, staff);

  res.redirect(`/ct/case/${case_id}`);
};

exports.expire_files = async (req, res) => {
  const expiredFiles = await ct.getExpiredFiles();
  console.log('Expired files:', expiredFiles);
  await ct.deleteImagesFromStorage(expiredFiles.map(file => file.filename));
  const affectedRows = await ct.markFilesAsExpired(expiredFiles.map((file) => file.id));
  console.log(`${affectedRows} files were marked as EXPIRED.`);
  res.redirect("/ct");
};

// For resetting database during testing
exports.delete_all = async (req, res) => {
  await ct.ClearDatabase();
  res.redirect(`/ct`);
};
