const statuses = [
  'New',
  'Investigating',
  'Waiting on Customer',
  'Waiting on Partner',
  'Ready for Resolution',
  'Completed',
  'Canceled',
];

const solutions = [
  'Replacement',
  'Reshipment',
  'Repair Assistance',
  'Information Only',
  'Other',
];

const cancelReasons = [
  'Customer withdrew request',
  'Unable to verify issue',
  'Duplicate case',
  'Other',
];

const claimTypes = [
  'Defect',
  'Lost in transit',
  'Delivered with missing items',
  'Wrong item shipped',
  'Other',
];

const shippingMethods = [
  'DHL',
  'EMS',
  'ECMS',
  'Air Parcel',
  'Domestic',
  'Other',
];

module.exports = {
  statuses,
  solutions,
  cancelReasons,
  claimTypes,
  shippingMethods,
};
