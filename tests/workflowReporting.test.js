// Exercise Sequelize's actual SQL generation without connecting to a database.
const Sequelize = require('sequelize');

describe('workflow reporting exclusion queries', () => {
  let sequelize, query, controller;
  const originalId = process.env.TEST_WORKFLOW_ID;
  const render = async (handler, role = 'admin') => {
    const res = { render: jest.fn() };
    const next = jest.fn();
    await controller[handler]({ query: {}, user: { id: 7, role } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalled();
    return query.mock.calls.map(([sql]) => sql);
  };

  beforeAll(() => {
    sequelize = new Sequelize('gcs_workflow_test', 'root', '', { dialect: 'mysql', logging: false });
    const models = { sequelize, Op: Sequelize.Op, ...require('../models/workflow')(sequelize, Sequelize),
      User: require('../models/user')(sequelize, Sequelize) };
    query = jest.spyOn(sequelize, 'query').mockImplementation(async sql => /count\(/i.test(sql) && !/GROUP BY/.test(sql) ? { count: 0 } : []);
    jest.doMock('../sequelize', () => models);
    controller = require('../controllers/workflowController');
  });
  beforeEach(() => { query.mockClear(); });
  afterAll(async () => {
    if (originalId === undefined) delete process.env.TEST_WORKFLOW_ID;
    else process.env.TEST_WORKFLOW_ID = originalId;
    await sequelize.close();
  });

  test.each(['admin', 'user'])('history filters both rows and pagination totals for %s', async role => {
    process.env.TEST_WORKFLOW_ID = '2';
    const sql = await render('history', role);
    expect(sql).toHaveLength(2);
    sql.forEach(statement => expect(statement).toContain('`workflowRun`.`definitionId` != 2'));
    expect(sql.some(statement => statement.includes('LIMIT 0, 25'))).toBe(true);
    if (role === 'user') sql.forEach(statement => expect(statement).toContain('`participants`.`userId` = 7'));
  });

  test('all analytics aggregates and unassigned warnings exclude the configured definition', async () => {
    process.env.TEST_WORKFLOW_ID = ' 2 ';
    const sql = await render('analytics');
    expect(sql).toHaveLength(6);
    expect(sql[0]).toContain('`workflowRun`.`definitionId` != 2');
    for (const index of [1, 2, 5]) {
      expect(sql[index]).toContain('INNER JOIN `workflowRuns` AS `run`');
      expect(sql[index]).toContain('`run`.`definitionId` != 2');
    }
    expect(sql[1]).toContain('COUNT(`workflowEvent`.`id`)');
    expect(sql[2]).toContain('COUNT(`workflowTask`.`id`)');
    expect(sql[3]).toContain('`workflowDefinition`.`id` != 2');
    expect(sql[3]).toContain('`workflowDefinition`.`archived` = false');
  });

  test.each([undefined, '', 'invalid', '0', '-2', '2oops', '2.5', '9007199254740992'])('unset or invalid setting %s excludes nothing', async value => {
    if (value === undefined) delete process.env.TEST_WORKFLOW_ID;
    else process.env.TEST_WORKFLOW_ID = value;
    await render('history');
    const sql = await render('analytics');
    sql.forEach(statement => expect(statement).not.toMatch(/`(?:definitionId|id)` !=/));
  });
});
