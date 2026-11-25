jest.mock('../sequelize', () => ({
  sequelize: { transaction: callback => callback({}) },
  pmt: {
    PMTEntry: { findByPk: jest.fn(), findAll: jest.fn() },
    PMTLog: { create: jest.fn(), bulkCreate: jest.fn(), destroy: jest.fn() },
    PMTDependencies: { findAll: jest.fn(), destroy: jest.fn() },
    PMTVersion: { create: jest.fn() },
  },
}));

const { pmt } = require('../sequelize');
const service = require('../services/DocMgmtService');

test('repeat archiving preserves attribution and flags each direct child once per archive event', async () => {
  const entry = {
    type: 'Policy', archived: false,
    update: async changes => Object.assign(entry, changes),
  };
  pmt.PMTEntry.findByPk.mockResolvedValue(entry);
  pmt.PMTDependencies.findAll.mockResolvedValue([{ child_id: 3 }, { child_id: 3 }, { child_id: 5 }]);

  await service.setArchived(1, true, 'alice');
  await service.setArchived(1, true, 'bob');
  expect(pmt.PMTLog.create).toHaveBeenCalledTimes(1);
  expect(pmt.PMTLog.create.mock.calls[0][0].details).toBe('Archived by alice');
  expect(pmt.PMTLog.bulkCreate.mock.calls[0][0].map(log => [log.entry_id, log.action]))
    .toEqual([[3, 'flagged-for-review'], [5, 'flagged-for-review']]);
  expect(pmt.PMTLog.bulkCreate).toHaveBeenCalledTimes(1);
  await service.setArchived(1, false, 'bob');
  expect(pmt.PMTLog.destroy.mock.calls[0][0].where).toEqual({ action: 'archived', entry_id: 1 });
  await service.setArchived(1, true, 'bob');
  expect(pmt.PMTLog.create.mock.calls[1][0].details).toBe('Archived by bob');
});

test('archived entries reject edits and version reversions before making changes', async () => {
  pmt.PMTEntry.findByPk.mockResolvedValue({ archived: true });
  await expect(service.updateEntry({ entryId: 1 })).rejects.toMatchObject({ status: 409 });
  await expect(service.revertToVersion({ entryId: 1 })).rejects.toMatchObject({ status: 409 });
  expect(pmt.PMTVersion.create).not.toHaveBeenCalled();
});

test('editing a child preserves archived parents and rejects selecting them', async () => {
  const entry = { id: 2, current_version: 1, archived: false, save: jest.fn() };
  pmt.PMTEntry.findByPk.mockResolvedValue(entry);
  pmt.PMTDependencies.findAll.mockImplementation(async ({ where }) =>
    where.child_id ? [{ parent_id: 1 }, { parent_id: 4 }] : []);
  pmt.PMTEntry.findAll.mockResolvedValue([{ id: 1, archived: true }, { id: 4, archived: false }]);
  const edit = { entryId: 2, title: 'Manual', newContentMarkdown: 'Updated', user: 'alice' };

  await expect(service.updateEntry({ ...edit, parentIds: [1] })).rejects.toMatchObject({ status: 400 });
  expect(entry.save).not.toHaveBeenCalled();
  await service.updateEntry({ ...edit, parentIds: [] });
  expect(pmt.PMTDependencies.destroy.mock.calls[0][0].where).toEqual({ child_id: 2, parent_id: [4] });
  expect(entry.current_version).toBe(2);
});
