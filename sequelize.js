const Sequelize = require('sequelize');
// Load models: GCS Tool
const EntryModel = require('./models/entry');
const ContentModel = require('./models/content');
const StaffModel = require('./models/staff');
const HolidayModel = require('./models/holiday');
const ScheduleModel = require('./models/schedule');
const Schedule2Model = require('./models/schedule2');
const UserModel = require('./models/user');
const UsernameModel = require('./models/username');
const HSCodeListModel = require('./models/hscodelist');
const IrelandTaricMappingModel = require('./models/irelandtaricmapping');
const IrelandTaricExplanationModel = require('./models/irelandtaricexplanation');
const IrelandWorkSummaryModel = require('./models/irelandworksummary');
const ShipcostModel = require('./models/shipcost');
const ChatmsgModel = require('./models/chatmsg');
const MeetingModel = require('./models/meeting');
const MeetingCommentModel = require('./models/meeting_comment');
const FormV2Model = require('./models/form_v2');
const FormFormatModel = require('./models/form_format');
const UpdatenoticeModel = require('./models/updatenotice');
const VersionHistoryModel = require('./models/versionhistory');
const HostSampleModel = require('./models/host_sample');
const AppSettingModel = require('./models/appSetting');
const OfficialCountryListModel = require('./models/OfficialCountryList');
const InternalCountryListModel = require('./models/InternalCountryList');
const JapanPostCountryListModel = require('./models/JapanPostCountryList');
const CountryCodeEntryIdLinkModel = require('./models/CountryCodeEntryIdLink');
const DHLCompensationEntryModel = require('./models/dhl_compensation_entry');
// Load models: Tracker
const CountryModel = require('./models/country');
const CountrylistModel = require('./models/countrylist');
const TrackingModel = require('./models/tracking');
const TrackingMonitorGroupModel = require('./models/trackingMonitorGroup');
const TrackingMonitorEntryModel = require('./models/trackingMonitorEntry');
const TrackingMonitorShortcutModel = require('./models/trackingMonitorShortcut');
const ReturnShippingCostAnalyticsModel = require('./models/returnShippingCostAnalytics');
const Trackhist0Model = require('./models/trackhist0');
const Trackhist1Model = require('./models/trackhist1');
const Trackhist2Model = require('./models/trackhist2');
const Trackhist3Model = require('./models/trackhist3');
const Trackhist4Model = require('./models/trackhist4');
// Case tracker
const CaseModel = require('./models/ct/caseRecord');
const ComplaintTypeModel = require('./models/ct/complaintType');
const SolutionTypeModel = require('./models/ct/solutionType');
const ShippingMethodModel = require('./models/ct/shippingMethod');
// Policy/Manual/Template
const PMTEntryModel = require('./models/pmt/pmt_entry');
const PMTDependenciesModel = require('./models/pmt/pmt_dependencies');
const PMTVersionModel = require('./models/pmt/pmt_version');
const PMTLogModel = require('./models/pmt/pmt_log');
const { seedAppSettings } = require('./services/appSettings');

// Connect to DB: GCS Tool
const sequelize = new Sequelize(process.env.DB_NAME_GCS, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});
// Connect to DB: Tracker
const sequelize_tracker = new Sequelize(process.env.DB_NAME_TRACK, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});
// Connect to DB: DHL compensation
const dhlCompensationDatabase = process.env.DB_NAME_DHL_COMPENSATION || process.env.DB_NAME_GCS;
const sequelize_dhl_compensation = new Sequelize(dhlCompensationDatabase, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});

// Attach DB to model: GCS Tool
const Entry = EntryModel(sequelize, Sequelize);
const Content = ContentModel(sequelize, Sequelize);
const Staff = StaffModel(sequelize, Sequelize);
const Holiday = HolidayModel(sequelize, Sequelize);
const Schedule = ScheduleModel(sequelize, Sequelize);
const Schedule2 = Schedule2Model(sequelize, Sequelize);
const User = UserModel(sequelize, Sequelize);
const Username = UsernameModel(sequelize, Sequelize);
const HSCodeList = HSCodeListModel(sequelize, Sequelize);
const IrelandTaricMapping = IrelandTaricMappingModel(sequelize, Sequelize);
const IrelandTaricExplanation = IrelandTaricExplanationModel(sequelize, Sequelize);
const IrelandWorkSummary = IrelandWorkSummaryModel(sequelize, Sequelize);
const Shipcost = ShipcostModel(sequelize, Sequelize);
const Chatmsg = ChatmsgModel(sequelize, Sequelize);
const Meeting = MeetingModel(sequelize, Sequelize);
const MeetingComment = MeetingCommentModel(sequelize, Sequelize);
const FormV2 = FormV2Model(sequelize, Sequelize);
const FormFormat = FormFormatModel(sequelize, Sequelize);
const Updatenotice = UpdatenoticeModel(sequelize, Sequelize);
const VersionHistory = VersionHistoryModel(sequelize, Sequelize);
const HostSample = HostSampleModel(sequelize, Sequelize);
const AppSetting = AppSettingModel(sequelize, Sequelize);
const OfficialCountryList = OfficialCountryListModel(sequelize, Sequelize);
const InternalCountryList = InternalCountryListModel(sequelize, Sequelize);
const JapanPostCountryList = JapanPostCountryListModel(sequelize, Sequelize);
const CountryCodeEntryIdLink = CountryCodeEntryIdLinkModel(sequelize, Sequelize);
const DHLCompensationEntry = DHLCompensationEntryModel(sequelize_dhl_compensation, Sequelize);
// Attach DB to model: Tracker
const Country = CountryModel(sequelize_tracker, Sequelize);
const Countrylist = CountrylistModel(sequelize_tracker, Sequelize);
const Tracking = TrackingModel(sequelize_tracker, Sequelize);
const TrackingMonitorGroup = TrackingMonitorGroupModel(sequelize_tracker, Sequelize);
const TrackingMonitorEntry = TrackingMonitorEntryModel(sequelize_tracker, Sequelize);
const TrackingMonitorShortcut = TrackingMonitorShortcutModel(sequelize_tracker, Sequelize);
const ReturnShippingCostAnalytics = ReturnShippingCostAnalyticsModel(sequelize_tracker, Sequelize);
const Trackhist0 = Trackhist0Model(sequelize_tracker, Sequelize);
const Trackhist1 = Trackhist1Model(sequelize_tracker, Sequelize);
const Trackhist2 = Trackhist2Model(sequelize_tracker, Sequelize);
const Trackhist3 = Trackhist3Model(sequelize_tracker, Sequelize);
const Trackhist4 = Trackhist4Model(sequelize_tracker, Sequelize);
// Case tracker
const Case = CaseModel(sequelize, Sequelize);
const ComplaintType = ComplaintTypeModel(sequelize, Sequelize);
const SolutionType = SolutionTypeModel(sequelize, Sequelize);
const ShippingMethod = ShippingMethodModel(sequelize, Sequelize);
// Policy/Manual/Template
const PMTEntry = PMTEntryModel(sequelize, Sequelize);
const PMTDependencies = PMTDependenciesModel(sequelize, Sequelize);
const PMTVersion = PMTVersionModel(sequelize, Sequelize);
const PMTLog = PMTLogModel(sequelize, Sequelize);

// Create table relations: GCS Tool
Entry.Content = Entry.hasMany(Content);
Staff.Schedule = Staff.hasMany(Schedule);
Staff.Schedule2 = Staff.hasMany(Schedule2);

const Op = Sequelize.Op;
const fn = Sequelize.fn;
const literal = Sequelize.literal;

async function ensureDhlCompensationEntrySchema() {
  const queryInterface = sequelize_dhl_compensation.getQueryInterface();
  const tableName = DHLCompensationEntry.getTableName();
  const columns = await queryInterface.describeTable(tableName);
  const requiredColumns = {
    pdf_original_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    pdf_storage_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  };

  for (const [columnName, definition] of Object.entries(requiredColumns)) {
    if (!columns[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
      console.log(`Added column "${columnName}" to ${tableName}.`);
    }
  }
}

async function ensureIrelandWorkSummarySchema() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = IrelandWorkSummary.getTableName();
  const columns = await queryInterface.describeTable(tableName);

  if (!columns.countryCode) {
    await queryInterface.addColumn(tableName, 'countryCode', {
      type: Sequelize.STRING(2),
      allowNull: false,
      defaultValue: 'IE',
    });
    console.log(`Added column "countryCode" to ${tableName}.`);
  }

  await IrelandWorkSummary.update({
    countryCode: 'IE',
  }, {
    where: {
      [Op.or]: [
        { countryCode: null },
        { countryCode: '' },
      ],
    },
  });

  const indexes = await queryInterface.showIndex(tableName);
  const hasIndex = (name) => indexes.some((index) => index.name === name);

  if (hasIndex('idx_ire_work_summary_order')) {
    await queryInterface.removeIndex(tableName, 'idx_ire_work_summary_order');
    console.log(`Removed order-only unique index from ${tableName}.`);
  }

  if (!hasIndex('idx_ire_work_summary_country_order')) {
    await queryInterface.addIndex(tableName, ['countryCode', 'orderNumber'], {
      name: 'idx_ire_work_summary_country_order',
      unique: true,
    });
    console.log(`Added country/order unique index to ${tableName}.`);
  }

  if (!hasIndex('idx_ire_work_summary_added_date')) {
    await queryInterface.addIndex(tableName, ['addedDate'], {
      name: 'idx_ire_work_summary_added_date',
    });
    console.log(`Added addedDate index to ${tableName}.`);
  }
}

async function seedVersionHistoryData() {
  const versionHistoryData = require('./data/versionHistory');

  for (let i = 0; i < versionHistoryData.length; i++) {
    const update = versionHistoryData[i];
    const payload = {
      version: update.version,
      releaseDate: update.releaseDate,
      updateDate: update.updateDate,
      sortOrder: i,
      changesJson: JSON.stringify(update.items),
    };

    const existing = await VersionHistory.findOne({
      where: { version: update.version },
    });

    if (existing) {
      await existing.update(payload);
    } else {
      await VersionHistory.create(payload);
    }
  }
}

async function ensureCaseTrackerSchema() {
  const queryInterface = sequelize.getQueryInterface();
  const caseTable = Case.getTableName();
  const complaintTypeTable = ComplaintType.getTableName();
  const caseColumns = await queryInterface.describeTable(caseTable);
  const complaintTypeColumns = await queryInterface.describeTable(complaintTypeTable);

  if (caseColumns.defect_items && !caseColumns.defect_items.type.toUpperCase().includes('TEXT')) {
    await queryInterface.changeColumn(caseTable, 'defect_items', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    console.log(`Changed "defect_items" to TEXT in ${caseTable}.`);
  }

  if (!complaintTypeColumns.required_fields) {
    await queryInterface.addColumn(complaintTypeTable, 'required_fields', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '[]',
    });

    // Preserve the old keyword-based behavior once, then use only the saved configuration.
    const complaintTypes = await ComplaintType.findAll();
    for (const complaintType of complaintTypes) {
      const name = complaintType.name.toLowerCase();
      const requiredFields = [];
      if (['ship', 'shipment', 'shipping', 'lost', 'stuck', 'damage', 'damaged'].some((keyword) => name.includes(keyword))) {
        requiredFields.push('shipping_method');
      }
      if (['lost', 'stuck'].some((keyword) => name.includes(keyword))) {
        requiredFields.push('shipping_date');
      }
      if (name.includes('defect')) {
        requiredFields.push('defect_items');
      }
      await complaintType.update({ required_fields: JSON.stringify(requiredFields) });
    }
    console.log(`Added "required_fields" to ${complaintTypeTable}.`);
  }
}

// Create all necessary tables: GCS Tool
sequelize.sync().then(async () => {
  await seedAppSettings(AppSetting);
  await ensureCaseTrackerSchema();
  await ensureIrelandWorkSummarySchema();
  await seedVersionHistoryData();
  console.log(`Database & tables syncronized! [GCS Tool]`);
});
// Create all necessary tables: Tracker
sequelize_tracker.sync().then(() => {
  console.log(`Database & tables syncronized! [Tracker]`);
});
// Create all necessary tables: DHL compensation
sequelize_dhl_compensation.sync()
  .then(async () => {
    console.log(`Database & tables syncronized! [DHL Compensation: ${dhlCompensationDatabase}]`);
    await ensureDhlCompensationEntrySchema();
  })
  .catch((error) => {
    console.error('Failed to synchronize DHL compensation database:', error);
  });

// Export models
module.exports = {
  sequelize,
  sequelize_tracker,
  sequelize_dhl_compensation,
  Entry,
  Content,
  Staff,
  Holiday,
  Schedule,
  Schedule2,
  User,
  Username,
  HSCodeList,
  IrelandTaricMapping,
  IrelandTaricExplanation,
  IrelandWorkSummary,
  Shipcost,
  Chatmsg,
  Meeting,
  MeetingComment,
  FormV2,
  FormFormat,
  Updatenotice,
  VersionHistory,
  HostSample,
  AppSetting,
  OfficialCountryList,
  InternalCountryList,
  JapanPostCountryList,
  CountryCodeEntryIdLink,
  Country,
  Countrylist,
  Tracking,
  TrackingMonitorGroup,
  TrackingMonitorEntry,
  TrackingMonitorShortcut,
  ReturnShippingCostAnalytics,
  Trackhist0,
  Trackhist1,
  Trackhist2,
  Trackhist3,
  Trackhist4,
  dhlCompensation: {
    Entry: DHLCompensationEntry,
  },
  Trackhist: {
    0: Trackhist0,
    1: Trackhist1,
    2: Trackhist2,
    3: Trackhist3,
    4: Trackhist4,
  },
  ct: {
    Case,
    ComplaintType,
    SolutionType,
    ShippingMethod,
  },
  pmt: {
    PMTEntry,
    PMTDependencies,
    PMTVersion,
    PMTLog,
  },
  Op,
  fn,
  literal,
};
