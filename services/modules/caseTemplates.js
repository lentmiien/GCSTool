const templates = [
  {
    id: 'defect-replacement',
    name: 'Defect - Replacement',
    description: 'For defective items that require investigation and a replacement shipment.',
    defaults: {
      type: 'Defect',
      status: 'Investigating',
      solution: 'Replacement',
      deadlineDays: 7,
      requiredFields: ['customer_id', 'tracking', 'shipping_method', 'items_text', 'initial_comment'],
    },
  },
  {
    id: 'lost-in-transit',
    name: 'Lost In Transit',
    description: 'Use when the parcel is reported lost and the team must coordinate with the carrier.',
    defaults: {
      type: 'Lost in transit',
      status: 'Waiting on Partner',
      solution: 'Reshipment',
      deadlineDays: 5,
      requiredFields: ['customer_id', 'tracking', 'shipping_method', 'initial_comment'],
    },
  },
  {
    id: 'info-follow-up',
    name: 'Information Only',
    description: 'Quick follow-up cases that only require investigation and documentation.',
    defaults: {
      type: 'Other',
      status: 'New',
      solution: 'Information Only',
      deadlineDays: 3,
      requiredFields: ['customer_id', 'initial_comment'],
    },
  },
];

module.exports = templates;
