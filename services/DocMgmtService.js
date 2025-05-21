const { pmt, Op } = require('../sequelize');

class DocMgmtService {
  async createEntry({type, title, content_md, category, user}) {
    try {
      // 1. Create Entry (no current_version yet)
      const newEntry = await pmt.PMTEntry.create({
        type,
        title,
        content_md,
        current_version: 1,
        category,
      });

      // 2. Create first Version
      const newVersion = await pmt.PMTVersion.create({
        entry_id: newEntry.id,
        content_md,
        version_number: 1,
        created_by: user,
      });

      // 3. Add log
      const newLog = await pmt.PMTLog.create({
        action: "created",
        entry_id: newEntry.id,
        action_by: user,
        details: `Created new ${type} entry with version 1`,
      });

      return newEntry.id;
    } catch (error) {
      console.error("Error creating entry:", error);
      throw error;
    }
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

  async updateEntry({entryId, title, newContentMarkdown, user}) {
    try {
      const entry = await pmt.PMTEntry.findByPk(entryId);
      if (!entry) throw new Error('Entry not found');

      // Determine new version number
      const nextVersionNum = entry.current_version + 1;

      // Create new Version
      const newVersion = await pmt.PMTVersion.create({
        entry_id: entry.id,
        content_md: newContentMarkdown,
        version_number: nextVersionNum,
        created_by: user,
      });

      // Update entry
      entry.title = title;
      entry.current_version = nextVersionNum;
      entry.content_md = newContentMarkdown;
      await entry.save();

      // Add log
      const newLog = await pmt.PMTLog.create({
        action: "modified",
        entry_id: entry.id,
        action_by: user,
        details: `Content updated to version ${nextVersionNum}`,
      });

      // Flag descendants for review
      const descendants = await this.fetchChildDependencies(entryId);
      for (const child of descendants) {
        const newLogForReview = await pmt.PMTLog.create({
          action: "flagged-for-review",
          entry_id: child.child_id,
          action_by: user,
          details: `Dependency parent (ID ${entryId}) updated. Please review this entry.`,
        });
      }

      return entryId;
    } catch (error) {
      console.error("Error updating entry:", error);
      throw error;
    }
  }

  async revertToVersion({ entryId, revertToVersionId, user }) {
    try {
      const entry = await pmt.PMTEntry.findByPk(entryId);
      if (!entry) throw new Error('Entry not found');
      const oldVersion = await pmt.PMTVersion.findByPk(revertToVersionId);
      if (!oldVersion || oldVersion.entry_id !== entryId) throw new Error('Version not found for this entry');

      // Determine new version number
      const nextVersionNum = entry.current_version + 1;

      // Create new Version
      const newVersion = await pmt.PMTVersion.create({
        entry_id: entry.id,
        content_md: oldVersion.content_md,
        version_number: nextVersionNum,
        created_by: user,
      });

      // Update entry
      entry.current_version = nextVersionNum;
      entry.content_md = oldVersion.content_md;
      await entry.save();

      // Add log
      const newLog = await pmt.PMTLog.create({
        action: "reverted",
        entry_id: entry.id,
        action_by: user,
        details: `Reverted to version ${oldVersion.version_number} (ID ${revertToVersionId})`,
      });

      // Flag descendants for review
      const descendants = await this.fetchChildDependencies(entryId);
      for (const child of descendants) {
        const newLogForReview = await pmt.PMTLog.create({
          action: "flagged-for-review",
          entry_id: child.child_id,
          action_by: user,
          details: `Dependency parent (ID ${entryId}) updated. Please review this entry.`,
        });
      }

      return entryId;
    } catch (error) {
      console.error("Error reverting entry:", error);
      throw error;
    }
  }

  async addDependency({ parentEntryId, childEntryId, user }) {
    const newDependency = await pmt.PMTDependencies.create({
      parent_id: parentEntryId,
      child_id: childEntryId,
    });

    // Add log
    const newLog = await pmt.PMTLog.create({
      action: "dependencies-updated",
      entry_id: childEntryId,
      action_by: user,
      details: `Now depends on entry ID ${parentEntryId} (dependency ID ${newDependency.id})`,
    });
  }

  async fetchEntries({ type = null, category = null } = {}) {
    const where = {};
    if (type) where.type = type;
    if (category) where.category = category;
  
    const options = {
      where,
      order: [['updatedAt', 'DESC']]
    };
  
    // If neither type nor category is provided, limit the results to 25
    if (!type && !category) {
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

  async replaceParents({ entryId, parentIds, user }) {
    // delete existing
    await pmt.PMTDependencies.destroy({ where: { child_id: entryId }});
    // re‑add
    for (const pid of parentIds) {
      await this.addDependency({ parentEntryId: pid, childEntryId: entryId, user });
    }
  }

  async fetchParentDependencies(entryId) {
    return await pmt.PMTDependencies.findAll({where: {child_id: entryId}});
  }
  
  async fetchChildDependencies(entryId) {
    return await pmt.PMTDependencies.findAll({where: {parent_id: entryId}});
  }

  async fetchVersionHistory(entryId) {
    return await pmt.PMTVersion.findAll({where: {entry_id: entryId}});
  }

  async fetchLogs(entryId) {
    return await pmt.PMTLog.findAll({where: {entry_id: entryId}});
  }

  async fetchPolicies() {
    return await pmt.PMTEntry.findAll({ where: { type: 'Policy' }});
  }

  async ClearDatabase() {
    await pmt.PMTEntry.destroy({ where: {}, truncate: true });
    await pmt.PMTDependencies.destroy({ where: {}, truncate: true });
    await pmt.PMTVersion.destroy({ where: {}, truncate: true });
    await pmt.PMTLog.destroy({ where: {}, truncate: true });
  }
}

module.exports = new DocMgmtService();
