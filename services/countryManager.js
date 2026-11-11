const { isDeepStrictEqual } = require('util');
const { Op } = require('sequelize');
const { fail } = require('../utils/japanPostCsv');
const { sources, methods, flag, code, normalize, key, sorted, parseImport, changes, exactNameMappings, mappingCountries, resolveCountry, cutoff } = require('../utils/countryManager');
const plain = row => row.get ? row.get({ plain: true }) : row;
const hiddenMethodsKey = 'COUNTRY_MANAGER_HIDDEN_METHODS';

function createService(models, options = {}) {
  const { sequelize, CountryManagerState: State, CountryManagerVersion: Version, JapanPostCsvCache: JapanPost, AppSetting } = models;
  const now = options.now || (() => new Date());
  let initializing;
  async function initialize() {
    if (!initializing) initializing = (async () => {
      if (models.gcsDatabaseReady) await models.gcsDatabaseReady;
      await State.findOrCreate({ where: { id: 1 }, defaults: { revision: 0 } });
      await sequelize.transaction(async transaction => {
        const lock = await State.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
        if (lock.revision) return;
        const website = (await models.OfficialCountryList.findAll({ order: [['id', 'ASC']], transaction })).map(plain);
        const internal = (await models.InternalCountryList.findAll({ order: [['createdAt', 'ASC'], ['id', 'ASC']], transaction })).map(plain);
        // Old CID/name links do not identify CSV country codes reliably. Require explicit mappings.
        const latest = rows => [...new Map(rows.map(row => [row.countryCode, row])).values()];
        const recordedAt = now();
        await Version.bulkCreate([
          { source: 'website', data: sorted(latest(website).map(row => ({ countryCode: row.countryCode, countryName: row.countryName }))) },
          { source: 'internal', data: sorted(latest(internal).map(row => ({ countryCode: row.countryCode, countryName: row.countryName, countryNameJ: row.countryNameJ || '', DHL: flag(row.DHLAvailability), AIT: flag(row.AITAvailability), ECMS: null }))) },
          { source: 'mappings', data: [] }, { source: 'exceptions', data: [] },
        ].map(row => ({ ...row, recordedAt, actor: 'System', note: 'Initial baseline from legacy data; earlier state is not reconstructed.' })), { transaction });
        await lock.update({ revision: 1 }, { transaction });
      });
    })().catch(error => { initializing = null; throw error; });
    return initializing;
  }
  async function versions(transaction, at) {
    return (await Version.findAll({ where: at ? { recordedAt: { [Op.lte]: at } } : {}, order: [['id', 'ASC']], transaction })).map(plain);
  }
  const stateOf = rows => Object.fromEntries(sources.map(source => [source, (rows.filter(row => row.source === source).pop() || {}).data || []]));
  async function jpVersions(transaction, at) {
    return (await JapanPost.findAll({ where: at ? { detectedAt: { [Op.lte]: at } } : {}, order: [['id', 'ASC']], transaction })).map(plain);
  }
  async function hiddenMethods(transaction) {
    const setting = await AppSetting.findOne({ where: { key: hiddenMethodsKey }, transaction });
    const hidden = new Set(setting ? setting.value.split(',') : []);
    return methods.filter(method => hidden.has(method.key)).map(method => method.key);
  }

  async function saveMethodVisibility(input) {
    const selected = input.visibleMethods === undefined ? [] : Array.isArray(input.visibleMethods) ? input.visibleMethods : [input.visibleMethods];
    if (selected.some(value => !methods.some(method => method.key === value))) fail('Choose supported shipping methods.');
    if (!/^\d+$/.test(String(input.revision))) fail('Reload the page before saving.', 409);
    const hidden = methods.filter(method => !selected.includes(method.key)).map(method => method.key);
    await initialize();
    return sequelize.transaction(async transaction => {
      const lock = await State.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
      if (Number(input.revision) !== lock.revision) fail('The data changed while this page was open. Reload and review it before saving.', 409);
      if (isDeepStrictEqual(await hiddenMethods(transaction), hidden)) return { changed: 0, revision: lock.revision };
      await AppSetting.upsert({ key: hiddenMethodsKey, value: hidden.join(',') }, { transaction });
      await lock.update({ revision: lock.revision + 1 }, { transaction });
      return { changed: 1, revision: lock.revision };
    });
  }
  async function read(query = {}) {
    const at = cutoff(query.at);
    await initialize();
    return sequelize.transaction({ isolationLevel: 'REPEATABLE READ' }, async transaction => {
      const lock = await State.findByPk(1, { transaction });
      const records = await versions(transaction, at);
      const state = stateOf(records);
      const jpHistory = await jpVersions(transaction, at);
      const jp = [...new Map(jpHistory.map(row => [row.countryCode, row])).values()];
      const allCountries = [...new Map([...state.internal, ...state.website].map(row => [row.countryCode, row])).values()].sort((a, b) => a.countryName.localeCompare(b.countryName));
      const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
      const rows = state.website.map(row => resolveCountry(row, state, jp)).filter(row => !q || [row.countryCode, row.countryName, row.internal && row.internal.countryNameJ, row.mapping && row.mapping.jpCode].some(value => value && value.toLowerCase().includes(q))).sort((a, b) => a.countryName.localeCompare(b.countryName));
      return { state, rows, allCountries, jp, revision: lock.revision, at, baseline: records[0] && records[0].recordedAt,
        hiddenMethods: await hiddenMethods(transaction),
        mappingCountries: mappingCountries(state), autoMapCandidates: exactNameMappings(state.website, state.mappings, jp),
        missingInternal: state.website.filter(row => !state.internal.some(item => item.countryCode === row.countryCode)).length,
        missingMapping: state.website.filter(row => !state.mappings.some(item => item.countryCode === row.countryCode)).length,
        missingJapanPost: state.website.filter(row => { const mapping = state.mappings.find(item => item.countryCode === row.countryCode); return mapping && !jp.some(item => item.countryCode === mapping.jpCode); }).length,
      };
    });
  }
  async function save(source, input, actor, imported) {
    if (!sources.includes(source)) fail('Unknown data source.');
    if (!['save', 'delete', 'import', 'auto-map'].includes(input.action)) fail('Unknown edit action.');
    if (input.action === 'auto-map' && source !== 'mappings') fail('Auto-mapping is only available for country mappings.');
    const row = input.action === 'save' ? normalize(source, input) : null;
    const deleteKey = input.action === 'delete' ? key({ countryCode: code(input.countryCode), method: source === 'exceptions' ? input.method : '' }) : null;
    if (input.action === 'import' && !imported) fail('Choose a CSV file.');
    if (!/^\d+$/.test(String(input.revision))) fail('Reload the page before saving.', 409);
    await initialize();
    return sequelize.transaction(async transaction => {
      const lock = await State.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
      if (Number(input.revision) !== lock.revision) fail('The data changed while this page was open. Reload and review it before saving.', 409);
      const records = await versions(transaction);
      const state = stateOf(records);
      let next;
      if (input.action === 'import') next = imported;
      else if (input.action === 'auto-map') next = [...state.mappings, ...exactNameMappings(state.website, state.mappings, await jpVersions(transaction))];
      else if (input.action === 'delete') next = state[source].filter(item => key(item) !== deleteKey);
      else next = [...state[source].filter(item => key(item) !== key(row)), row];
      next = sorted(next);
      if (source === 'mappings' || source === 'exceptions') {
        const known = new Set([...state.website, ...state.internal].map(item => item.countryCode));
        const jpCodes = source === 'mappings' ? new Set((await jpVersions(transaction)).map(item => item.countryCode)) : null;
        for (const item of next) {
          if (state[source].some(previous => isDeepStrictEqual(previous, item))) continue;
          if (!known.has(item.countryCode)) fail(`Add ${item.countryCode} to the website or internal list first.`);
          if (jpCodes && !jpCodes.has(item.jpCode)) fail(`Japan Post code ${item.jpCode} has no imported limits data. Import it in Japan Post limits first.`);
        }
      }
      const diff = changes(state[source], next);
      if (isDeepStrictEqual(state[source], next)) return { changed: 0, revision: lock.revision };
      // Strictly increasing timestamps make timeline links unambiguous for successive edits.
      const lastTime = Math.max(...records.map(item => new Date(item.recordedAt).getTime()));
      const recordedAt = new Date(Math.max(now().getTime(), lastTime + 1));
      await Version.create({ source, data: next, recordedAt, actor: String(actor || 'User').slice(0, 255),
        note: input.action === 'import' ? 'CSV replacement import' : input.action === 'auto-map' ? 'Auto-mapped exact English names' : input.action === 'delete' ? 'Removed entry' : 'Saved entry' }, { transaction });
      await lock.update({ revision: lock.revision + 1 }, { transaction });
      return { changed: diff.length, revision: lock.revision };
    });
  }
  async function importCsv(source, input, buffer, actor) {
    const records = await parseImport(source, buffer);
    return save(source, { ...input, action: 'import' }, actor, records);
  }
  async function history(countryCode) {
    if (countryCode) code(countryCode);
    await initialize();
    return sequelize.transaction({ isolationLevel: 'REPEATABLE READ' }, async transaction => {
      const records = await versions(transaction);
      const jp = await jpVersions(transaction);
      const previous = Object.fromEntries(sources.map(source => [source, []]));
      const events = records.map(record => {
        const diff = changes(previous[record.source], record.data);
        previous[record.source] = record.data;
        return { ...record, changes: countryCode ? diff.filter(row => row.countryCode === countryCode) : diff };
      }).filter(event => !countryCode || event.changes.length);
      const jpBefore = new Map();
      for (const record of jp) {
        const old = jpBefore.get(record.countryCode) || {};
        jpBefore.set(record.countryCode, record.data);
        const mappings = stateOf(records.filter(row => new Date(row.recordedAt) <= new Date(record.detectedAt))).mappings;
        if (countryCode && !mappings.some(row => row.countryCode === countryCode && row.jpCode === record.countryCode)) continue;
        const fields = [...new Set([...Object.keys(old), ...Object.keys(record.data)])].filter(field => old[field] !== record.data[field]).map(field => ({ field, before: old[field], after: record.data[field] }));
        events.push({ id: `jp-${record.id}`, source: 'Japan Post', recordedAt: record.detectedAt, actor: record.sourceName, note: `${record.countryCode} · ${record.data['国名（英語）']}`,
          changes: [{ countryCode: record.countryCode, action: Object.keys(old).length ? 'Changed' : 'Added', fields }] });
      }
      return events.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt) || String(b.id).localeCompare(String(a.id)));
    });
  }
  return { read, save, importCsv, history, saveMethodVisibility };
}
module.exports = { createService };
