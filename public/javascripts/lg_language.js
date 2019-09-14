var json_language = {
  _template_: {
    english: 'Template',
    swedish: 'Mall',
    japanese: 'テンプレート'
  },
  _templates_: {
    english: 'Templates',
    swedish: 'Mallar',
    japanese: 'テンプレート'
  },
  _manual_: {
    english: 'Manual',
    swedish: 'Manual',
    japanese: 'マニュアル'
  },
  _manuals_: {
    english: 'Manuals',
    swedish: 'Manualer',
    japanese: 'マニュアル'
  },
  _ccontact_: {
    english: 'Company Contact',
    swedish: 'Företags Kontakt',
    japanese: '会社連絡'
  },
  _create_new_: {
    english: 'Create New',
    swedish: 'Skapa Ny',
    japanese: '新規作成'
  },
  _input_: {
    english: 'Input',
    swedish: 'Inmatning',
    japanese: '入力'
  },
  _content_: {
    english: 'Content',
    swedish: 'Innehåll',
    japanese: 'コンテンツ'
  },
  _scheduler_: {
    english: 'Scheduler',
    swedish: 'Schemaläggare',
    japanese: 'スケジューラ'
  },
  _about_: {
    english: 'About',
    swedish: 'Om',
    japanese: 'アバウト'
  },
  _jan_: {
    english: 'January',
    swedish: 'Januari',
    japanese: '1月'
  },
  _feb_: {
    english: 'February',
    swedish: 'Februari',
    japanese: '2月'
  },
  _mar_: {
    english: 'March',
    swedish: 'Mars',
    japanese: '3月'
  },
  _apr_: {
    english: 'April',
    swedish: 'April',
    japanese: '4月'
  },
  _may_: {
    english: 'May',
    swedish: 'Maj',
    japanese: '5月'
  },
  _jun_: {
    english: 'June',
    swedish: 'Juni',
    japanese: '6月'
  },
  _jul_: {
    english: 'July',
    swedish: 'Juli',
    japanese: '7月'
  },
  _aug_: {
    english: 'August',
    swedish: 'Augusti',
    japanese: '8月'
  },
  _sep_: {
    english: 'September',
    swedish: 'September',
    japanese: '9月'
  },
  _oct_: {
    english: 'October',
    swedish: 'Oktober',
    japanese: '10月'
  },
  _nov_: {
    english: 'November',
    swedish: 'November',
    japanese: '11月'
  },
  _dec_: {
    english: 'December',
    swedish: 'December',
    japanese: '12月'
  },
  _m_: {
    english: 'Monday',
    swedish: 'Måndag',
    japanese: '月曜日'
  },
  _tu_: {
    english: 'Tuesday',
    swedish: 'Tisdag',
    japanese: '火曜日'
  },
  _w_: {
    english: 'Wednesday',
    swedish: 'Onsdag',
    japanese: '水曜日'
  },
  _th_: {
    english: 'Thursday',
    swedish: 'Torsdag',
    japanese: '木曜日'
  },
  _f_: {
    english: 'Friday',
    swedish: 'Fredag',
    japanese: '金曜日'
  },
  _sa_: {
    english: 'Saturday',
    swedish: 'Lördag',
    japanese: '土曜日'
  },
  _su_: {
    english: 'Sunday',
    swedish: 'Söndag',
    japanese: '日曜日'
  },
  _all_: {
    english: 'All',
    swedish: 'Alla',
    japanese: 'すべて'
  },
  _account_related_: {
    english: 'Account related',
    swedish: 'Angående Konto',
    japanese: 'アカウント関連'
  },
  _order_item_statuses_: {
    english: 'Order/Item statuses',
    swedish: 'Beställning/Artikel Statusar',
    japanese: '注文・商品状況'
  },
  _order_modifying_: {
    english: 'Modifying Orders',
    swedish: 'Beställning Redigering',
    japanese: '注文変更'
  },
  _payment_shipping_: {
    english: 'Paymemnts/Shipment',
    swedish: 'Betalning/Frakt',
    japanese: '入金・発送'
  },
  _after_service_shipping_: {
    english: 'Shipment After Service',
    swedish: 'Efter Service Frakt',
    japanese: '発送サポート'
  },
  _after_service_defect_: {
    english: 'Defects After Service',
    swedish: 'Efter Service Defekt',
    japanese: '不良サポート'
  },
  _after_service_preowned_: {
    english: 'Pre-owned After Service',
    swedish: 'Efter Service Begagnad',
    japanese: '中古サポート'
  },
  _returns_refunds_: {
    english: 'Returns/Refunds',
    swedish: 'Returer/Återbetalning',
    japanese: '返品・返金'
  },
  _claims_cases_: {
    english: 'Claims',
    swedish: 'Klagomål',
    japanese: 'クレーム'
  },
  _work_related_: {
    english: 'About Work',
    swedish: 'Angående Jobbet',
    japanese: '仕事関連'
  },
  _case_assist_: {
    english: 'Case Assistance',
    swedish: 'Case Assist',
    japanese: 'ケースサポート'
  },
  _customer_dep_: {
    english: 'Customer Support',
    swedish: 'Kund Support',
    japanese: 'カスタマーサポート'
  },
  _logistics_dep_: {
    english: 'Logistics',
    swedish: 'Logistik',
    japanese: 'ロジ'
  },
  _feedback_: {
    english: 'Feedback',
    swedish: 'Feedback',
    japanese: 'フィードバック'
  },
  _other_: {
    english: 'Other',
    swedish: 'Annat',
    japanese: 'その他'
  }
  /*,
  __: {
    english: '',
    swedish: '',
    japanese: ''
  }
  */
};

var language_id = 'japanese';
function UpdateLanguage(source) {
  language_id = document.getElementById(source).value;
  var z = document.getElementsByTagName('*');

  for (var i = 0; i < z.length; i++) {
    var elmnt = z[i];
    var lval = elmnt.getAttribute('lg_language');
    if (lval) {
      elmnt.innerHTML = json_language[lval][language_id];
    }
  }
}
UpdateLanguage('lg_language');

function GetData(key) {
  return json_language[key][language_id];
}

function GetHTMLElement(key) {
  return '<span lg_language="' + key + '">' + json_language[key][language_id] + '</span>';
}
