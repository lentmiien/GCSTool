const { normalize, digest, fail, CODE, ID, object } = require('./irelandTaricProtocol');
const CONTROL = '00000000000000000000000000000000';
const DAY = 86400000;
function createStore({ IrelandTaricJob: Job, sequelize, Op }, now = Date.now) {
  const plain = row => row && row.get({ plain: true });
  async function owned(owner, id, options = {}) {
    if (!ID.test(id) || id === CONTROL) fail('NOT_FOUND', 404);
    const row = await Job.findOne({ where: { id, owner }, ...options });
    if (!row) fail('NOT_FOUND', 404);
    return row;
  }
  async function ensureControl() {
    await Job.findOrCreate({ where: { id: CONTROL }, defaults: { owner: 'system', input: {}, state: 'control',
      nextAt: new Date(0), expiresAt: new Date('2099-01-01'), leaseUntil: new Date(0) } });
  }
  async function create(owner, body) {
    const input = normalize(body);
    if (input.id === CONTROL) fail('INVALID_REQUEST');
    await ensureControl();
    return sequelize.transaction(async transaction => {
      // Serialize admission across processes, bounding both the global queue and each owner.
      await Job.findByPk(CONTROL, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await Job.findByPk(input.id, { transaction });
      if (existing) {
        if (existing.owner !== owner) fail('NOT_FOUND', 404);
        if (existing.digest !== digest(input)) fail('IDEMPOTENCY_CONFLICT', 409);
        return plain(existing);
      }
      if (await Job.count({ where: { state: { [Op.in]: ['queued', 'pending', 'paused'] } }, transaction }) >= 200
        || await Job.count({ where: { owner, createdAt: { [Op.gt]: new Date(now() - DAY) } }, transaction }) >= 500
        || await Job.count({ where: { owner, state: { [Op.in]: ['queued', 'pending'] } }, transaction }) >= 20) fail('LOCAL_QUEUE_FULL', 429);
      return plain(await Job.create({ id: input.id, owner, input, digest: digest(input),
        nextAt: new Date(now()), expiresAt: new Date(now() + DAY) }, { transaction }));
    });
  }
  async function selection(owner, id, body) {
    object(body, ['selected_code']);
    if (typeof body.selected_code !== 'string' || !CODE.test(body.selected_code)) fail('INVALID_FEEDBACK');
    return sequelize.transaction(async transaction => {
      const row = await owned(owner, id, { transaction, lock: transaction.LOCK.UPDATE });
      if (row.selectedCode && row.selectedCode !== body.selected_code) fail('SELECTION_IMMUTABLE', 409);
      if (!row.selectedCode) await row.update({ selectedCode: body.selected_code, feedback: 'pending',
        nextAt: new Date(now()), expiresAt: new Date(now() + 7 * DAY) }, { transaction });
      return plain(row);
    });
  }
  return {
    create, selection,
    get: async (owner, id) => plain(await owned(owner, id)),
    async list(owner) {
      const active = await Job.findAll({ where: { owner, state: { [Op.in]: ['pending', 'paused'] } },
        order: [['createdAt', 'ASC']], limit: 20 });
      const recent = await Job.findAll({ where: { owner }, order: [['createdAt', 'DESC']], limit: 50 });
      return [...new Map([...active, ...recent].map(row => [row.id, plain(row)])).values()];
    },
    async resume(owner, id) {
      return sequelize.transaction(async transaction => {
        const row = await owned(owner, id, { transaction, lock: transaction.LOCK.UPDATE });
        if (row.resumes >= 3 || row.createdAt.getTime() < now() - 7 * DAY) fail('RETRY_LIMIT', 409);
        if (row.state !== 'paused' && row.feedback !== 'failed') return plain(row);
        // An unknown submit outcome still occupies its admission slot while replaying.
        await row.update({ state: row.state === 'paused' ? 'pending' : row.state,
          feedback: row.selectedCode && row.feedback !== 'sent' ? 'pending' : row.feedback,
          error: null, attempts: 0, polls: 0, resumes: row.resumes + 1, nextAt: new Date(now()), expiresAt: new Date(now() + DAY) }, { transaction });
        return plain(row);
      });
    },
    async claim(token) {
      await ensureControl();
      const [count] = await Job.update({ leaseUntil: new Date(now() + 60000), leaseOwner: token },
        { where: { id: CONTROL, leaseUntil: { [Op.lt]: new Date(now()) } } });
      return count === 1;
    },
    release: token => Job.update({ leaseUntil: new Date(0) }, { where: { id: CONTROL, leaseOwner: token } }),
    async due() {
      // Outstanding remote jobs and uncertain submit outcomes reserve the two admission slots.
      const active = await Job.count({ where: { state: { [Op.in]: ['pending', 'paused'] } } });
      const states = active < 2 ? ['queued', 'pending'] : ['pending'];
      const row = await Job.findOne({ where: { nextAt: { [Op.lte]: new Date(now()) },
        [Op.or]: [{ state: { [Op.in]: states } }, { feedback: 'pending', state: { [Op.in]: ['terminal', 'paused', 'rejected'] } }] },
      order: [['nextAt', 'ASC'], ['createdAt', 'ASC']] });
      return plain(row);
    },
    update: (id, values) => Job.update(values, { where: { id } }),
    cleanup: () => Job.destroy({ where: { state: { [Op.in]: ['terminal', 'rejected', 'paused'] },
      updatedAt: { [Op.lt]: new Date(now() - 30 * DAY) } } }),
  };
}
module.exports = { createStore };
