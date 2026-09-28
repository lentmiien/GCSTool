jest.mock('../sequelize', () => ({
  pmt: {
    PMTEntry: { findAll: jest.fn() },
    PMTDependencies: { findAll: jest.fn() },
  },
}));

const { pmt } = require('../sequelize');
const service = require('../services/DocMgmtService');

test('related documents include all direct parents’ children once, excluding self and deeper relationships', async () => {
  const dependencies = [
    { parent_id: 1, child_id: 3 },
    { parent_id: 2, child_id: 3 },
    { parent_id: 1, child_id: 4 },
    { parent_id: 2, child_id: 4 },
    { parent_id: 2, child_id: 5 },
    { parent_id: 9, child_id: 1 }, // Grandparent.
    { parent_id: 9, child_id: 6 }, // Grandparent's other child.
    { parent_id: 4, child_id: 7 }, // Sibling policy's child.
    { parent_id: 3, child_id: 8 }, // Current policy's own child.
    { parent_id: 1, child_id: 99 }, // Deleted entry.
  ];
  const entries = [
    { id: 4, type: 'Policy' }, { id: 5, type: 'Template' },
    { id: 6, type: 'Manual' }, { id: 7, type: 'Manual' }, { id: 8, type: 'Manual' },
  ];
  pmt.PMTDependencies.findAll.mockImplementation(async ({ where }) =>
    dependencies.filter(dependency => where.parent_id.includes(dependency.parent_id)));
  pmt.PMTEntry.findAll.mockImplementation(async ({ where }) =>
    entries.filter(entry => where.id.includes(entry.id)));

  expect(await service.fetchRelatedEntries(3, [1, 2])).toEqual(entries.slice(0, 2));
  expect(pmt.PMTDependencies.findAll).toHaveBeenCalledTimes(1);
  expect(pmt.PMTEntry.findAll.mock.calls[0][0].where.id).toEqual([4, 5, 99]);
});

test('no parents returns no related documents without a database lookup', async () => {
  expect(await service.fetchRelatedEntries(3, [])).toEqual([]);
  expect(pmt.PMTDependencies.findAll).not.toHaveBeenCalled();
  expect(pmt.PMTEntry.findAll).not.toHaveBeenCalled();
});

test('a parent with only the current entry returns no related documents', async () => {
  pmt.PMTDependencies.findAll.mockResolvedValue([{ parent_id: 1, child_id: 3 }]);
  expect(await service.fetchRelatedEntries(3, [1])).toEqual([]);
  expect(pmt.PMTEntry.findAll).not.toHaveBeenCalled();
});
