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
const ShipcostModel = require('./models/shipcost');
const ChatmsgModel = require('./models/chatmsg');
const MeetingModel = require('./models/meeting');
const MeetingCommentModel = require('./models/meeting_comment');
const FormV2Model = require('./models/form_v2');
const FormFormatModel = require('./models/form_format');
const UpdatenoticeModel = require('./models/updatenotice');
const OfficialCountryListModel = require('./models/OfficialCountryList');
const InternalCountryListModel = require('./models/InternalCountryList');
const JapanPostCountryListModel = require('./models/JapanPostCountryList');
const CountryCodeEntryIdLinkModel = require('./models/CountryCodeEntryIdLink');
// Load models: Tracker
const CountryModel = require('./models/country');
const CountrylistModel = require('./models/countrylist');
const TrackingModel = require('./models/tracking');
// Case tracker
const CaseModel = require('./models/ct/ctCase');
const ProcessedByModel = require('./models/ct/ctProcessedBy');
const CommentModel = require('./models/ct/ctComment');
const ItemModel = require('./models/ct/ctItem');
const AssistantRecordModel = require('./models/ct/ctAssistantRecord');
const FileModel = require('./models/ct/ctFile');
const RefundModel = require('./models/ct/ctRefund');
const CaseApprovalModel = require('./models/ct/ctCaseApproval');
const ApproverPrivilegeModel = require('./models/ct/ctApproverPrivilege');
const CTAuditLogModel = require('./models/ct/ctAuditLog');
const CTZendeskModel = require('./models/ct/ctZendesk');
// Policy/Manual/Template
const PMTEntryModel = require('./models/pmt/pmt_entry');
const PMTDependenciesModel = require('./models/pmt/pmt_dependencies');
const PMTVersionModel = require('./models/pmt/pmt_version');
const PMTLogModel = require('./models/pmt/pmt_log');

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
const Shipcost = ShipcostModel(sequelize, Sequelize);
const Chatmsg = ChatmsgModel(sequelize, Sequelize);
const Meeting = MeetingModel(sequelize, Sequelize);
const MeetingComment = MeetingCommentModel(sequelize, Sequelize);
const FormV2 = FormV2Model(sequelize, Sequelize);
const FormFormat = FormFormatModel(sequelize, Sequelize);
const Updatenotice = UpdatenoticeModel(sequelize, Sequelize);
const OfficialCountryList = OfficialCountryListModel(sequelize, Sequelize);
const InternalCountryList = InternalCountryListModel(sequelize, Sequelize);
const JapanPostCountryList = JapanPostCountryListModel(sequelize, Sequelize);
const CountryCodeEntryIdLink = CountryCodeEntryIdLinkModel(sequelize, Sequelize);
// Attach DB to model: Tracker
const Country = CountryModel(sequelize_tracker, Sequelize);
const Countrylist = CountrylistModel(sequelize_tracker, Sequelize);
const Tracking = TrackingModel(sequelize_tracker, Sequelize);
// Case tracker
const Case = CaseModel(sequelize, Sequelize);
const ProcessedBy = ProcessedByModel(sequelize, Sequelize);
const Comment = CommentModel(sequelize, Sequelize);
const Item = ItemModel(sequelize, Sequelize);
const AssistantRecord = AssistantRecordModel(sequelize, Sequelize);
const File = FileModel(sequelize, Sequelize);
const Refund = RefundModel(sequelize, Sequelize);
const CaseApproval = CaseApprovalModel(sequelize, Sequelize);
const ApproverPrivilege = ApproverPrivilegeModel(sequelize, Sequelize);
const CTAuditLog = CTAuditLogModel(sequelize, Sequelize);
const Zendesk = CTZendeskModel(sequelize, Sequelize);
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

// Create all necessary tables: GCS Tool
sequelize.sync().then(() => {
  console.log(`Database & tables syncronized! [GCS Tool]`);
});
// Create all necessary tables: Tracker
sequelize_tracker.sync().then(() => {
  console.log(`Database & tables syncronized! [Tracker]`);
});

// Export models
module.exports = {
  Entry,
  Content,
  Staff,
  Holiday,
  Schedule,
  Schedule2,
  User,
  Username,
  HSCodeList,
  Shipcost,
  Chatmsg,
  Meeting,
  MeetingComment,
  FormV2,
  FormFormat,
  Updatenotice,
  OfficialCountryList,
  InternalCountryList,
  JapanPostCountryList,
  CountryCodeEntryIdLink,
  Country,
  Countrylist,
  Tracking,
  ct: {
    Case,
    ProcessedBy,
    Comment,
    Item,
    AssistantRecord,
    File,
    Refund,
    CaseApproval,
    ApproverPrivilege,
    AuditLog: CTAuditLog,
    Zendesk,
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

