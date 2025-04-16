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
      const children = await this.fetchChildDependencies(entryId);

      // All versions for history
      const versions = await this.fetchVersionHistory(entryId);

      return {
        entry,
        logs,
        parents,
        children,
        versions,
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
      throw error;
    }
  }

  async updateEntry({entryId, newContentMarkdown, user}) {
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
    let rows = [];

    if (type && category) {
      rows = await pmt.PMTEntry.findAll({where: {type, category}});
    } else if (type) {
      rows = await pmt.PMTEntry.findAll({where: {type}});
    } else if (category) {
      rows = await pmt.PMTEntry.findAll({where: {category}});
    } else {
      rows = await pmt.PMTEntry.findAll();
    }

    return rows;
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
}

module.exports = new DocMgmtService();
