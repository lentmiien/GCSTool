jest.mock('../sequelize', () => ({
  CountryManagerVersion: { findOne: jest.fn() },
  InternalCountryList: { findAll: jest.fn() },
}));
const models = require('../sequelize');
const { generate } = require('../controllers/trackerController');

test('tracker autocomplete follows the current internal snapshot, including an empty list', async () => {
  const res = { render: jest.fn() }, next = jest.fn();
  models.CountryManagerVersion.findOne.mockResolvedValue({ data: [{ countryName: 'New destination' }, { countryName: 'New destination' }] });
  await generate({}, res, next);
  expect(res.render.mock.calls[0][1].auto_complete.filter(name => name === 'New destination')).toHaveLength(1);
  expect(models.InternalCountryList.findAll).not.toHaveBeenCalled();
  models.CountryManagerVersion.findOne.mockResolvedValue({ data: [] });
  await generate({}, res, next);
  expect(models.InternalCountryList.findAll).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('tracker uses legacy names before the first manager baseline and forwards database failures', async () => {
  const res = { render: jest.fn() }, next = jest.fn();
  models.CountryManagerVersion.findOne.mockResolvedValue(null);
  models.InternalCountryList.findAll.mockResolvedValue([{ countryName: 'Legacy destination' }]);
  await generate({}, res, next);
  expect(res.render.mock.calls[0][1].auto_complete).toContain('Legacy destination');
  const error = new Error('Database unavailable');
  models.CountryManagerVersion.findOne.mockRejectedValueOnce(error);
  await generate({}, res, next);
  expect(next).toHaveBeenCalledWith(error);
});
