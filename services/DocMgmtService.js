const { pmt, Op, sequelize } = require('../sequelize');
const { fn, col, where: sqlWhere } = require('sequelize');
const parseSearchTerms = require('../utils/parseSearchTerms');

async function lockEntry(entryId, transaction) {
  const entry = await pmt.PMTEntry.findByPk(entryId, { transaction, lock: true });
  if (!entry) throw new Error('Entry not found');
  return entry;
}

function requireEditable(entry) {
  if (entry.archived) {
    throw Object.assign(new Error('Restore this entry before editing it.'), { status: 409 });
  }
}

async function flagChildren(entryId, user, reason, transaction) {
  const children = await pmt.PMTDependencies.findAll({
    where: { parent_id: entryId }, transaction, lock: true,
  });
  const childIds = [...new Set(children.map(child => child.child_id))];
  if (childIds.length) {
    await pmt.PMTLog.bulkCreate(childIds.map(childId => ({
      action: 'flagged-for-review',
      entry_id: childId,
      action_by: user,
      details: `Dependency parent (ID ${entryId}) ${reason}. Please review this entry.`,
    })), { transaction });
  }
}

async function setParents(entryId, parentIds, user, transaction) {
  const links = await pmt.PMTDependencies.findAll({ where: { child_id: entryId }, transaction, lock: true });
  const existing = new Set(links.map(link => link.parent_id));
  const ids = [...new Set([...parentIds, ...existing])];
  if (!ids.length) return;

  const policies = await pmt.PMTEntry.findAll({
    where: { id: ids, type: 'Policy' }, transaction, lock: true,
  });
  const active = new Set(policies.filter(policy => !policy.archived).map(policy => policy.id));
  if (parentIds.some(id => !active.has(id))) {
    throw Object.assign(new Error('Choose an active parent policy.'), { status: 400 });
  }

  // Archived parents are omitted from the picker. Keep their existing links.
  const removed = [...existing].filter(id => active.has(id) && !parentIds.includes(id));
  if (removed.length) {
    await pmt.PMTDependencies.destroy({ where: { child_id: entryId, parent_id: removed }, transaction });
  }
  for (const parentId of parentIds.filter(id => !existing.has(id))) {
    const link = await pmt.PMTDependencies.create({ parent_id: parentId, child_id: entryId }, { transaction });
    await pmt.PMTLog.create({
      action: 'dependencies-updated', entry_id: entryId, action_by: user,
      details: `Now depends on entry ID ${parentId} (dependency ID ${link.id})`,
    }, { transaction });
  }
}

async function saveVersion(entry, content, user, action, details, transaction) {
  entry.current_version += 1;
  entry.content_md = content;
  await entry.save({ transaction });
  await pmt.PMTVersion.create({
    entry_id: entry.id, version_number: entry.current_version, content_md: content, created_by: user,
  }, { transaction });
  await pmt.PMTLog.create({ action, entry_id: entry.id, action_by: user, details }, { transaction });
  await flagChildren(entry.id, user, 'updated', transaction);
  return entry.id;
}

class DocMgmtService {
  async createEntry({ type, title, content_md, category, user, parentIds = [] }) {
    return sequelize.transaction(async transaction => {
      const newEntry = await pmt.PMTEntry.create({
        type,
        title,
        content_md,
        current_version: 1,
        category,
      }, { transaction });

      await pmt.PMTVersion.create({
        entry_id: newEntry.id,
        content_md,
        version_number: 1,
        created_by: user,
      }, { transaction });

      await pmt.PMTLog.create({
        action: 'created',
        entry_id: newEntry.id,
        action_by: user,
        details: `Created new ${type} entry with version 1`,
      }, { transaction });

      await setParents(newEntry.id, parentIds, user, transaction);
      return newEntry.id;
    });
  }

  async fetchEntry(entryId) {
    try {
      const entry = await pmt.PMTEntry.findByPk(entryId);
      if (!entry) throw new Error('Entry not found');

      // Logs
      const logs = await this.fetchLogs(entryId);

      // Dependencies
      const parents = await this.fetchParentDependencies(entryId);
      const parentEntries = await pmt.PMTEntry.findAll({ where: { id: parents.map(p=>p.parent_id) }});
      const children = await this.fetchChildDependencies(entryId);
      const childEntries = await pmt.PMTEntry.findAll({ where: { id: children.map(c=>c.child_id) }});

      // All versions for history
      const versions = await this.fetchVersionHistory(entryId);

      return {
        entry,
        logs,
        parents,
        parentEntries,
        children,
        childEntries,
        versions,
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
      throw error;
    }
  }

  async updateEntry({ entryId, title, newContentMarkdown, user, parentIds }) {
    return sequelize.transaction(async transaction => {
      const entry = await lockEntry(entryId, transaction);
      requireEditable(entry);
      if (parentIds) await setParents(entryId, parentIds, user, transaction);
      entry.title = title;
      return saveVersion(entry, newContentMarkdown, user, 'modified',
        `Content updated to version ${entry.current_version + 1}`, transaction);
    });
  }

  async revertToVersion({ entryId, revertToVersionId, user }) {
    return sequelize.transaction(async transaction => {
      const entry = await lockEntry(entryId, transaction);
      requireEditable(entry);
      const version = await pmt.PMTVersion.findByPk(revertToVersionId, { transaction });
      if (!version || version.entry_id !== entryId) throw new Error('Version not found for this entry');
      return saveVersion(entry, version.content_md, user, 'reverted',
        `Reverted to version ${version.version_number} (ID ${revertToVersionId})`, transaction);
    });
  }

  async setArchived(entryId, archived, user) {
    return sequelize.transaction(async transaction => {
      const entry = await lockEntry(entryId, transaction);
      if (entry.archived === archived) return;
      await entry.update({ archived }, { transaction });
      if (archived) {
        await pmt.PMTLog.create({
          action: 'archived', entry_id: entryId, action_by: user, details: `Archived by ${user}`,
        }, { transaction });
        if (entry.type === 'Policy') await flagChildren(entryId, user, 'archived', transaction);
      } else {
        await pmt.PMTLog.destroy({ where: { entry_id: entryId, action: 'archived' }, transaction });
      }
    });
  }

  async deleteEntry(entryId) {
    return sequelize.transaction(async transaction => {
      const entry = await lockEntry(entryId, transaction);
      await pmt.PMTDependencies.destroy({
        where: { [Op.or]: [{ parent_id: entryId }, { child_id: entryId }] }, transaction,
      });
      const options = { where: { entry_id: entryId }, transaction };
      await pmt.PMTVersion.destroy(options);
      await pmt.PMTLog.destroy(options);
      await entry.destroy({ transaction });
    });
  }

  async fetchEntries({ type = null, category = null, search = '' } = {}) {
    const where = {};
    if (type) where.type = type;
    if (category) where.category = category;
    const terms = parseSearchTerms(search);
    if (terms.length > 0) {
      where[Op.and] = terms.map(term => ({
        // LOCATE treats %, _ and backslashes as literal text, not LIKE wildcards.
        [Op.or]: ['title', 'content_md'].map(field =>
          sqlWhere(fn('LOCATE', term, col(field)), { [Op.gt]: 0 })),
      }));
    }
  
    const options = {
      where,
      order: [['updatedAt', 'DESC']]
    };
  
    // Only the unfiltered library is limited to the 25 most recent entries.
    if (!type && !category && terms.length === 0) {
      options.limit = 25;
    }
  
    const rows = await pmt.PMTEntry.findAll(options);
    return rows;
  }
  

  async fetchAllLogs(where = {}) {
    return await pmt.PMTLog.findAll({ where, order: [['createdAt', 'DESC']] });
  }
  
  async markReviewCompleted({ logId, user }) {
    const log = await pmt.PMTLog.findByPk(logId);
    if (!log || log.action !== 'flagged-for-review') return false;
    log.action = 'review-completed';
    log.action_by = user;
    log.details += '  (completed)';
    await log.save();
    return true;
  }

  async fetchParentDependencies(entryId) {
    return await pmt.PMTDependencies.findAll({where: {child_id: entryId}});
  }
  
  async fetchChildDependencies(entryId) {
    return await pmt.PMTDependencies.findAll({where: {parent_id: entryId}});
  }

  async fetchRelatedEntries(entryId, parentIds) {
    if (parentIds.length === 0) return [];

    // Only the children of direct parents; never traverse ancestors or descendants.
    const dependencies = await pmt.PMTDependencies.findAll({
      where: { parent_id: parentIds },
    });
    const relatedIds = [...new Set(dependencies.map(dependency => dependency.child_id))]
      .filter(id => Number(id) !== Number(entryId));
    if (relatedIds.length === 0) return [];

    return pmt.PMTEntry.findAll({
      where: { id: relatedIds },
      order: [['type', 'ASC'], ['title', 'ASC']],
    });
  }

  async fetchVersionHistory(entryId) {
    return await pmt.PMTVersion.findAll({where: {entry_id: entryId}});
  }

  async fetchLogs(entryId) {
    return await pmt.PMTLog.findAll({where: {entry_id: entryId}});
  }

  async fetchPolicies() {
    return await pmt.PMTEntry.findAll({ where: { type: 'Policy', archived: false }});
  }

  async ClearDatabase() {
    await pmt.PMTEntry.destroy({ where: {}, truncate: true });
    await pmt.PMTDependencies.destroy({ where: {}, truncate: true });
    await pmt.PMTVersion.destroy({ where: {}, truncate: true });
    await pmt.PMTLog.destroy({ where: {}, truncate: true });
  }
}

module.exports = new DocMgmtService();
