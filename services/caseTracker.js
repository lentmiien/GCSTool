const { ct, Op } = require('../sequelize');
const templates = require('./modules/caseTemplates');
const metadata = require('./modules/caseMetadata');
const { getTodosForCase, getClosureIssues } = require('./modules/todoValidators');

const FINAL_STATUSES = ['Completed', 'Canceled'];
const DEFECT_SECONDARY_THRESHOLD = 4; // 4th defect case needs second opinion
const DEFECT_LEADER_THRESHOLD = 7; // >7 defect cases need leader approval

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isFinalStatus(status) {
  if (!status) return false;
  return FINAL_STATUSES.indexOf(status) !== -1;
}

function parseItemsFromText(itemsText) {
  if (!itemsText) return [];
  const lines = itemsText.split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    if (!line || !line.trim()) continue;
    const parts = line.split('|').map(part => part.trim());
    const item_code = parts[0];
    if (!item_code) continue;
    const defect = parts[1] || '';
    const item_cost = parseInteger(parts[2]) || 0;
    items.push({ item_code, defect, item_cost });
  }

  return items;
}

class CaseTrackerService {
  constructor() {
    this.templates = templates;
    this.metadata = metadata;
  }

  getTemplates() {
    return this.templates;
  }

  getTemplateById(id) {
    return this.templates.find(template => template.id === id);
  }

  getMetadata() {
    return this.metadata;
  }

  async getCasesDueSoon(days = 3) {
    const now = new Date();
    const upcoming = new Date(now);
    upcoming.setDate(upcoming.getDate() + days);

    const cases = await ct.Case.findAll({
      where: {
        status: {
          [Op.notIn]: FINAL_STATUSES,
        },
        deadline: {
          [Op.ne]: null,
          [Op.lte]: upcoming,
        },
      },
      order: [['deadline', 'ASC']],
    });

    return cases.map(entry => entry.toJSON());
  }

  async search(query) {
    const trimmed = sanitizeString(query);
    if (!trimmed) {
      return { type: 'empty' };
    }

    const isOrderNumber = /^\d{9}$/.test(trimmed);

    const findCaseByField = async (field, value, onlyOngoing = false) => {
      const whereClause = { [field]: value };
      if (onlyOngoing) {
        whereClause.status = { [Op.notIn]: FINAL_STATUSES };
      }
      return ct.Case.findOne({
        where: whereClause,
        order: [['started', 'DESC']],
      });
    };

    if (isOrderNumber) {
      const orderNumber = parseInt(trimmed, 10);
      const ongoingCase = await findCaseByField('order', orderNumber, true);
      if (ongoingCase) {
        return { type: 'case', id: ongoingCase.id };
      }
      const anyCase = await findCaseByField('order', orderNumber, false);
      if (anyCase) {
        return { type: 'case', id: anyCase.id };
      }
      return { type: 'newCase', order: trimmed };
    }

    const ongoingTracking = await findCaseByField('tracking', trimmed, true);
    if (ongoingTracking) {
      return { type: 'case', id: ongoingTracking.id };
    }

    const anyTracking = await findCaseByField('tracking', trimmed, false);
    if (anyTracking) {
      return { type: 'case', id: anyTracking.id };
    }

    const customerCases = await ct.Case.findAll({
      where: { customer_id: trimmed },
      order: [['started', 'DESC']],
    });
    if (customerCases.length > 0) {
      return { type: 'customer', customerId: trimmed };
    }

    const itemRecord = await ct.Item.findOne({ where: { item_code: trimmed } });
    if (itemRecord) {
      return { type: 'item', itemCode: trimmed };
    }

    return { type: 'notFound' };
  }

  async getCase(id) {
    const caseEntry = await ct.Case.findByPk(id);
    if (!caseEntry) {
      return null;
    }

    const [comments, items, audits, tickets, approvals, customerProfile] = await Promise.all([
      ct.Comment.findAll({ where: { case_id: id }, order: [['timestamp', 'ASC']] }),
      ct.Item.findAll({ where: { case_id: id }, order: [['created_date', 'ASC']] }),
      ct.AuditLog.findAll({ where: { case_id: id }, order: [['timestamp', 'DESC']] }),
      ct.Zendesk.findAll({ where: { case_id: id }, order: [['ticket', 'ASC']] }),
      ct.CaseApproval.findAll({ where: { case_id: id } }),
      this.getCustomerProfile(caseEntry.customer_id, { includeCases: false }),
    ]);

    const data = caseEntry.toJSON();
    data.comments = comments.map(comment => comment.toJSON());
    data.items = items.map(item => item.toJSON());
    data.audits = audits.map(audit => audit.toJSON());
    data.tickets = tickets.map(ticket => ticket.toJSON());
    const approvalRecords = approvals.map(entry => entry.toJSON());
    data.approvals = approvalRecords;

    data.customerSummary = {
      totalCases: customerProfile.totalCases,
      openCases: customerProfile.summary.open,
      defect: customerProfile.defectCounts,
    };

    data.approvalStatus = this.computeApprovalStatus(data, approvalRecords, customerProfile);
    data.todos = getTodosForCase(data);

    return data;
  }

  computeApprovalStatus(caseData, approvalRecords, customerProfile) {
    const type = (caseData.type || '').toLowerCase();
    const isDefectCaseType = type === 'defect';

    const required = { secondary: false, leader: false };
    const granted = { secondary: false, leader: false };

    approvalRecords.forEach(record => {
      if (!record.approval_type) return;
      const key = record.approval_type.toLowerCase();
      if (key === 'leader') {
        granted.leader = true;
      } else if (key === 'secondary') {
        granted.secondary = true;
      }
    });

    if (isDefectCaseType) {
      const defectTotal = customerProfile.defectCounts.total || 0;
      if (defectTotal >= DEFECT_SECONDARY_THRESHOLD) {
        required.secondary = true;
      }
      if (defectTotal > DEFECT_LEADER_THRESHOLD) {
        required.leader = true;
      }
    }

    if (required.leader) {
      required.secondary = true;
    }

    const missing = [];
    if (required.secondary && !granted.secondary) {
      missing.push('Secondary approval required (second opinion).');
    }
    if (required.leader && !granted.leader) {
      missing.push('Leader/management approval required.');
    }

    return {
      required,
      granted,
      missing,
      defectTotal: customerProfile.defectCounts.total || 0,
    };
  }

  async createCase(payload, staff) {
    const template = payload.template_id ? this.getTemplateById(payload.template_id) : null;
    const deadlineFromForm = toDate(payload.deadline);
    let deadline = deadlineFromForm;
    if (!deadline && template && template.defaults.deadlineDays) {
      const now = new Date();
      const d = new Date(now);
      d.setDate(d.getDate() + Number(template.defaults.deadlineDays));
      deadline = d;
    }

    const shippedDate = toDate(payload.shipped_date);
    const orderNumber = parseInteger(payload.order);

    if (!orderNumber) {
      throw new Error('Order number must be a 9 digit value.');
    }

    const newCase = await ct.Case.create({
      order: orderNumber,
      customer_id: sanitizeString(payload.customer_id),
      tracking: sanitizeString(payload.tracking),
      shipping_method: sanitizeString(payload.shipping_method),
      shipped_date: shippedDate,
      type: sanitizeString(payload.type) || 'Other',
      country: sanitizeString(payload.country),
      deadline,
      staff_in_charge: sanitizeString(payload.staff_in_charge) || staff || 'Unassigned',
      status: sanitizeString(payload.status) || 'New',
      solution: sanitizeString(payload.solution) || null,
      cancel_reason: null,
    });

    await this.logAudit(newCase.id, staff, 'Created case', {
      order: newCase.order,
      status: newCase.status,
      template: template ? template.id : null,
    });

    const initialComment = sanitizeString(payload.initial_comment);
    if (initialComment) {
      await this.addComment(newCase.id, staff, initialComment);
    }

    const items = parseItemsFromText(payload.items_text);
    for (const item of items) {
      await this.addOrUpdateItem(newCase.id, item, staff);
    }

    return newCase;
  }

  async updateCase(id, updates, staff) {
    const caseEntry = await ct.Case.findByPk(id);
    if (!caseEntry) {
      throw new Error('Case not found');
    }

    const allowedFields = [
      'customer_id',
      'tracking',
      'shipping_method',
      'shipped_date',
      'type',
      'country',
      'deadline',
      'staff_in_charge',
      'status',
      'solution',
      'cancel_reason',
    ];

    const changes = {};

    for (const field of allowedFields) {
      if (!(field in updates)) continue;
      let value = updates[field];
      if (field === 'deadline' || field === 'shipped_date') {
        value = toDate(value);
      } else if (typeof value === 'string') {
        value = value.trim();
        if (value.length === 0) {
          value = null;
        }
      }

      const currentValue = caseEntry[field];
      if (currentValue instanceof Date) {
        const current = currentValue ? currentValue.getTime() : null;
        const next = value ? value.getTime() : null;
        if (current !== next) {
          changes[field] = { before: currentValue, after: value };
          caseEntry[field] = value;
        }
      } else if (currentValue !== value) {
        changes[field] = { before: currentValue, after: value };
        caseEntry[field] = value;
      }
    }

    if (Object.keys(changes).length === 0) {
      return caseEntry;
    }

    await caseEntry.save();
    await this.logAudit(id, staff, 'Updated case', changes);
    return caseEntry;
  }

  async finalizeCase(id, action, staff) {
    const caseEntry = await ct.Case.findByPk(id);
    if (!caseEntry) {
      throw new Error('Case not found');
    }

    caseEntry.ended = new Date();
    caseEntry.deadline = null;
    await caseEntry.save();

    const logMessage = action === 'complete' ? 'Closed case as Completed' : 'Closed case as Canceled';
    await this.logAudit(id, staff, logMessage);
    return caseEntry;
  }

  async addTicket(caseId, ticketNumber, staff) {
    const ticket = parseInteger(ticketNumber);
    if (!ticket) {
      throw new Error('Ticket number must be numeric.');
    }

    const existing = await ct.Zendesk.findOne({ where: { case_id: caseId, ticket } });
    if (existing) {
      return existing.toJSON();
    }

    const record = await ct.Zendesk.create({
      case_id: caseId,
      ticket,
    });

    await this.logAudit(caseId, staff, 'Linked Zendesk ticket', { ticket });
    return record.toJSON();
  }

  async addComment(caseId, staff, comment) {
    const trimmed = sanitizeString(comment);
    if (!trimmed) {
      return null;
    }

    const newComment = await ct.Comment.create({
      case_id: caseId,
      staff,
      comment: trimmed,
    });

    await this.logAudit(caseId, staff, 'Added comment', { comment_id: newComment.id });
    return newComment;
  }

  async addOrUpdateItem(caseId, data, staff) {
    const payload = {
      item_code: sanitizeString(data.item_code),
      defect: sanitizeString(data.defect),
      item_cost: parseInteger(data.item_cost) || 0,
    };

    if (!payload.item_code) {
      throw new Error('Item code is required');
    }

    if (data.id) {
      const current = await ct.Item.findByPk(data.id);
      if (!current) {
        throw new Error('Item not found');
      }
      const updates = {};
      if (current.item_code !== payload.item_code) updates.item_code = payload.item_code;
      if ((current.defect || '') !== payload.defect) updates.defect = payload.defect;
      if (current.item_cost !== payload.item_cost) updates.item_cost = payload.item_cost;

      if (Object.keys(updates).length > 0) {
        await current.update(updates);
        await this.logAudit(caseId, staff, 'Updated item', { item_id: current.id, updates });
      }
      return current;
    }

    const newItem = await ct.Item.create({
      case_id: caseId,
      file_id: null,
      item_code: payload.item_code,
      defect: payload.defect,
      item_cost: payload.item_cost,
    });

    await this.logAudit(caseId, staff, 'Added item', { item_id: newItem.id, item_code: newItem.item_code });
    return newItem;
  }

  async deleteItem(caseId, itemId, staff) {
    const item = await ct.Item.findByPk(itemId);
    if (!item) {
      return;
    }
    await ct.Item.destroy({ where: { id: itemId } });
    await this.logAudit(caseId, staff, 'Removed item', { item_id: itemId, item_code: item.item_code });
  }

  async getCustomerProfile(customerId, options = {}) {
    const includeCases = options.includeCases !== false;
    const cases = await ct.Case.findAll({
      where: { customer_id: customerId },
      order: [['started', 'DESC']],
    });

    const plainCases = cases.map(entry => entry.toJSON());
    const insights = this.buildCustomerInsights(plainCases);

    const profile = {
      customerId,
      summary: insights.summary,
      totalCases: insights.totalCases,
      defectCounts: insights.defectCounts,
      matrix: insights.matrix,
    };

    if (includeCases) {
      profile.cases = plainCases;
    }

    return profile;
  }

  buildCustomerInsights(caseList) {
    const summary = { open: 0, closed: 0, byStatus: {} };
    const counts = {};
    const typeOrder = [...this.metadata.claimTypes];
    const solutionOrder = [...this.metadata.solutions, 'Unset'];
    let defectTotal = 0;
    let defectOngoing = 0;

    for (const entry of caseList) {
      const status = entry.status || 'Unknown';
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      if (isFinalStatus(status)) {
        summary.closed += 1;
      } else {
        summary.open += 1;
      }

      const typeLabel = entry.type || 'Unspecified';
      const solutionLabel = entry.solution || 'Unset';

      if (!typeOrder.includes(typeLabel)) {
        typeOrder.push(typeLabel);
      }
      if (!solutionOrder.includes(solutionLabel)) {
        solutionOrder.push(solutionLabel);
      }

      if (!counts[typeLabel]) {
        counts[typeLabel] = {};
      }
      if (!counts[typeLabel][solutionLabel]) {
        counts[typeLabel][solutionLabel] = { completed: 0, ongoing: 0 };
      }

      if (isFinalStatus(status)) {
        counts[typeLabel][solutionLabel].completed += 1;
      } else {
        counts[typeLabel][solutionLabel].ongoing += 1;
      }

      if ((entry.type || '').toLowerCase() === 'defect') {
        defectTotal += 1;
        if (!isFinalStatus(status)) {
          defectOngoing += 1;
        }
      }
    }

    const rows = typeOrder.map(type => ({
      type,
      cells: solutionOrder.map(solution => {
        const base = counts[type] && counts[type][solution];
        return base ? { ...base } : { completed: 0, ongoing: 0 };
      }),
    }));

    return {
      summary,
      totalCases: caseList.length,
      defectCounts: { total: defectTotal, ongoing: defectOngoing },
      matrix: {
        columns: solutionOrder,
        rows,
      },
    };
  }

  async getItemSummary() {
    const items = await ct.Item.findAll();
    const counts = {};

    for (const item of items) {
      if (!counts[item.item_code]) {
        counts[item.item_code] = 0;
      }
      counts[item.item_code] += 1;
    }

    return Object.keys(counts)
      .map(code => ({ item_code: code, count: counts[code] }))
      .sort((a, b) => b.count - a.count);
  }

  async getItemReport(itemCode) {
    const items = await ct.Item.findAll({
      where: { item_code: itemCode },
      order: [['created_date', 'DESC']],
    });

    if (!items.length) {
      return { itemCode, rows: [] };
    }

    const caseIds = [...new Set(items.map(item => item.case_id))];
    const relatedCases = await ct.Case.findAll({
      where: { id: { [Op.in]: caseIds } },
    });

    const caseMap = new Map();
    for (const entry of relatedCases) {
      caseMap.set(entry.id, entry.toJSON());
    }

    const rows = items.map(item => ({
      item: item.toJSON(),
      case: caseMap.get(item.case_id) || null,
    }));

    return { itemCode, rows };
  }

  async getRecentAudit(limit = 200) {
    const entries = await ct.AuditLog.findAll({
      order: [['timestamp', 'DESC']],
      limit,
    });
    return entries.map(entry => entry.toJSON());
  }

  getClosureIssues(caseData, action) {
    return getClosureIssues(caseData, action);
  }

  async getStaffPrivileges(staff) {
    if (!staff || staff === 'Guest') {
      return [];
    }
    const rows = await ct.ApproverPrivilege.findAll({ where: { user_id: staff } });
    return rows.map(row => (row.level || '').toLowerCase());
  }

  async recordApproval(caseId, approvalType, staff) {
    const normalized = approvalType === 'leader' ? 'leader' : 'secondary';

    const existing = await ct.CaseApproval.findOne({
      where: { case_id: caseId, approval_type: normalized },
    });

    if (existing) {
      if (existing.approved_by === staff) {
        return existing.toJSON();
      }
      const previous = existing.approved_by;
      existing.approved_by = staff;
      await existing.save();
      await this.logAudit(caseId, staff, `Updated ${normalized} approval`, {
        approval_type: normalized,
        previous,
      });
      return existing.toJSON();
    }

    const record = await ct.CaseApproval.create({
      case_id: caseId,
      approval_type: normalized,
      approved_by: staff,
    });

    await this.logAudit(caseId, staff, `Recorded ${normalized} approval`, { approval_type: normalized });
    return record.toJSON();
  }

  async logAudit(caseId, staff, action, metadata = {}) {
    await ct.AuditLog.create({
      case_id: caseId,
      staff,
      log: action,
      metadata: JSON.stringify(metadata),
    });
  }
}

module.exports = CaseTrackerService;
