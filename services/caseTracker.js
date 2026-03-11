const { ct, Op } = require('../sequelize');

const SHIPPING_METHOD_KEYWORDS = ['ship', 'shipment', 'shipping', 'lost', 'stuck', 'damage', 'damaged'];
const SHIPPING_DATE_KEYWORDS = ['lost', 'stuck'];
const DEFECT_KEYWORDS = ['defect'];

function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value) {
  const sanitized = sanitizeText(value);
  return sanitized || null;
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  const sanitized = sanitizeText(value);
  if (!sanitized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    return null;
  }

  const [year, month, day] = sanitized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return sanitized;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function containsKeyword(value, keywords) {
  const normalizedValue = sanitizeText(value).toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return keywords.some((keyword) => normalizedValue.indexOf(keyword) >= 0);
}

function getEffectiveComplaint(caseData) {
  return sanitizeText(caseData.customer_complaint_edit) || sanitizeText(caseData.customer_complaint);
}

function getRequirementFlags(complaintText) {
  return {
    needsShippingMethod: containsKeyword(complaintText, SHIPPING_METHOD_KEYWORDS),
    needsShippingDate: containsKeyword(complaintText, SHIPPING_DATE_KEYWORDS),
    needsDefectFields: containsKeyword(complaintText, DEFECT_KEYWORDS),
  };
}

function toPlainCase(caseEntry) {
  const data = caseEntry.toJSON ? caseEntry.toJSON() : { ...caseEntry };
  data.customer_id = data.customer_id || '';
  data.customer_complaint = data.customer_complaint || '';
  data.customer_complaint_edit = data.customer_complaint_edit || '';
  data.customer_complaint_comment = data.customer_complaint_comment || '';
  data.shipping_method = data.shipping_method || '';
  data.shipping_date = data.shipping_date || '';
  data.complaint_date = data.complaint_date || '';
  data.defect_items = data.defect_items || '';
  data.defect_description = data.defect_description || '';
  data.solution = data.solution || '';
  data.solved_date = data.solved_date || '';
  data.effective_complaint = getEffectiveComplaint(data);
  data.is_open = !data.solved_date;
  data.created_at_display = formatDateTime(data.createdAt);
  data.updated_at_display = formatDateTime(data.updatedAt);
  return data;
}

function buildValueOptions(rows, extraValues) {
  const values = rows.map((row) => row.name);

  extraValues.forEach((value) => {
    const sanitized = sanitizeText(value);
    if (sanitized && values.indexOf(sanitized) === -1) {
      values.unshift(sanitized);
    }
  });

  return values;
}

class CaseTrackerService {
  normalizeOrderNumber(orderNumber) {
    return sanitizeText(orderNumber);
  }

  async getLookupRows() {
    const [complaintTypes, solutionTypes] = await Promise.all([
      ct.ComplaintType.findAll({ order: [['name', 'ASC']] }),
      ct.SolutionType.findAll({ order: [['name', 'ASC']] }),
    ]);

    return { complaintTypes, solutionTypes };
  }

  async getDashboard() {
    const [openCases, complaintTypes, solutionTypes, totalCases] = await Promise.all([
      ct.Case.findAll({
        where: {
          solved_date: {
            [Op.is]: null,
          },
        },
        order: [['complaint_date', 'ASC'], ['updatedAt', 'ASC']],
      }),
      ct.ComplaintType.findAll({ order: [['name', 'ASC']] }),
      ct.SolutionType.findAll({ order: [['name', 'ASC']] }),
      ct.Case.count(),
    ]);

    return {
      openCases: openCases.map((entry) => toPlainCase(entry)),
      complaintTypes,
      solutionTypes,
      totalCases,
    };
  }

  async openCase(orderNumber) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      throw new Error('Order number is required.');
    }

    let caseEntry;
    let created = false;

    try {
      const result = await ct.Case.findOrCreate({
        where: { order_number: normalizedOrderNumber },
        defaults: {
          order_number: normalizedOrderNumber,
          complaint_date: todayDate(),
        },
      });
      caseEntry = result[0];
      created = result[1];
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        caseEntry = await ct.Case.findOne({ where: { order_number: normalizedOrderNumber } });
      } else {
        throw error;
      }
    }

    if (!caseEntry) {
      throw new Error('Failed to open case.');
    }

    return {
      caseEntry: toPlainCase(caseEntry),
      created,
    };
  }

  async getCaseView(orderNumber, draftCase, extras) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      return null;
    }

    const [caseEntry, lookupRows] = await Promise.all([
      ct.Case.findOne({ where: { order_number: normalizedOrderNumber } }),
      this.getLookupRows(),
    ]);

    if (!caseEntry) {
      return null;
    }

    const storedCase = toPlainCase(caseEntry);
    const caseDetails = {
      ...storedCase,
      ...(draftCase || {}),
    };

    caseDetails.effective_complaint = getEffectiveComplaint(caseDetails);
    caseDetails.is_open = !caseDetails.solved_date;
    caseDetails.created_at_display = storedCase.created_at_display;
    caseDetails.updated_at_display = storedCase.updated_at_display;

    let relatedCases = [];
    if (caseDetails.customer_id) {
      const relatedRows = await ct.Case.findAll({
        where: {
          customer_id: caseDetails.customer_id,
          order_number: {
            [Op.ne]: normalizedOrderNumber,
          },
        },
        order: [['complaint_date', 'DESC'], ['updatedAt', 'DESC']],
      });

      relatedCases = relatedRows.map((entry) => toPlainCase(entry));
    }

    const complaintOptions = buildValueOptions(lookupRows.complaintTypes, [
      caseDetails.customer_complaint,
      caseDetails.customer_complaint_edit,
    ]);
    const solutionOptions = buildValueOptions(lookupRows.solutionTypes, [caseDetails.solution]);

    return {
      caseDetails,
      relatedCases,
      complaintTypes: complaintOptions,
      solutionTypes: solutionOptions,
      requirements: getRequirementFlags(caseDetails.effective_complaint),
      hasComplaintTypes: lookupRows.complaintTypes.length > 0,
      hasSolutionTypes: lookupRows.solutionTypes.length > 0,
      errors: extras && extras.errors ? extras.errors : [],
      message: extras && extras.message ? extras.message : null,
    };
  }

  async updateCase(orderNumber, payload) {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber) {
      return { ok: false, notFound: true };
    }

    const [caseEntry, lookupRows] = await Promise.all([
      ct.Case.findOne({ where: { order_number: normalizedOrderNumber } }),
      this.getLookupRows(),
    ]);

    if (!caseEntry) {
      return { ok: false, notFound: true };
    }

    const errors = [];
    const originalComplaint = sanitizeText(caseEntry.customer_complaint);
    const currentComplaintEdit = sanitizeText(caseEntry.customer_complaint_edit);
    const currentSolution = sanitizeText(caseEntry.solution);

    const allowedComplaintValues = buildValueOptions(lookupRows.complaintTypes, [
      originalComplaint,
      currentComplaintEdit,
    ]);
    const allowedSolutionValues = buildValueOptions(lookupRows.solutionTypes, [currentSolution]);

    let nextOriginalComplaint = originalComplaint || null;
    const requestedOriginalComplaint = sanitizeText(payload.customer_complaint);
    if (!nextOriginalComplaint && requestedOriginalComplaint) {
      if (allowedComplaintValues.indexOf(requestedOriginalComplaint) === -1) {
        errors.push('Select a valid customer complaint.');
      } else {
        nextOriginalComplaint = requestedOriginalComplaint;
      }
    }

    let nextComplaintEdit = null;
    const requestedComplaintEdit = sanitizeText(payload.customer_complaint_edit);
    if (requestedComplaintEdit) {
      if (!nextOriginalComplaint) {
        errors.push('Set the original customer complaint before using complaint edit.');
      } else if (allowedComplaintValues.indexOf(requestedComplaintEdit) === -1) {
        errors.push('Select a valid complaint edit value.');
      } else {
        nextComplaintEdit = requestedComplaintEdit;
      }
    }

    let nextSolution = null;
    const requestedSolution = sanitizeText(payload.solution);
    if (requestedSolution) {
      if (allowedSolutionValues.indexOf(requestedSolution) === -1) {
        errors.push('Select a valid solution.');
      } else {
        nextSolution = requestedSolution;
      }
    }

    const complaintDateInput = sanitizeText(payload.complaint_date);
    const complaintDate = complaintDateInput
      ? normalizeDate(complaintDateInput)
      : normalizeDate(caseEntry.complaint_date || todayDate());
    if (complaintDateInput && !complaintDate) {
      errors.push('Complaint date must be a valid date.');
    }
    if (!complaintDate) {
      errors.push('Complaint date is required.');
    }

    const shippingDateInput = sanitizeText(payload.shipping_date);
    const shippingDate = shippingDateInput ? normalizeDate(shippingDateInput) : null;
    if (shippingDateInput && !shippingDate) {
      errors.push('Shipping date must be a valid date.');
    }

    const solvedDateInput = sanitizeText(payload.solved_date);
    const solvedDate = solvedDateInput ? normalizeDate(solvedDateInput) : null;
    if (solvedDateInput && !solvedDate) {
      errors.push('Solved date must be a valid date.');
    }

    const nextCase = {
      order_number: caseEntry.order_number,
      customer_id: sanitizeText(payload.customer_id),
      customer_complaint: nextOriginalComplaint || '',
      customer_complaint_edit: nextComplaintEdit || '',
      customer_complaint_comment: sanitizeText(payload.customer_complaint_comment),
      shipping_method: sanitizeText(payload.shipping_method),
      shipping_date: shippingDateInput || '',
      complaint_date: complaintDateInput || complaintDate || '',
      defect_items: sanitizeText(payload.defect_items),
      defect_description: sanitizeText(payload.defect_description),
      solution: nextSolution || '',
      solved_date: solvedDateInput || '',
    };

    const effectiveComplaint = getEffectiveComplaint(nextCase);
    const requirements = getRequirementFlags(effectiveComplaint);

    if (requirements.needsShippingMethod && !nextCase.shipping_method) {
      errors.push('Shipping method is required for shipping-related complaints.');
    }
    if (requirements.needsShippingDate && !shippingDate) {
      errors.push('Shipping date is required for lost or stuck shipment complaints.');
    }
    if (requirements.needsDefectFields && !nextCase.defect_items) {
      errors.push('Defect items are required for defect complaints.');
    }
    if (requirements.needsDefectFields && !nextCase.defect_description) {
      errors.push('Defect description is required for defect complaints.');
    }
    if (solvedDate && !nextSolution) {
      errors.push('Solution is required when a case is marked as solved.');
    }

    if (errors.length > 0) {
      return {
        ok: false,
        viewModel: await this.getCaseView(normalizedOrderNumber, nextCase, {
          errors,
          message: 'Case was not saved.',
        }),
      };
    }

    await caseEntry.update({
      customer_id: emptyToNull(nextCase.customer_id),
      customer_complaint: emptyToNull(nextCase.customer_complaint),
      customer_complaint_edit: emptyToNull(nextCase.customer_complaint_edit),
      customer_complaint_comment: emptyToNull(nextCase.customer_complaint_comment),
      shipping_method: emptyToNull(nextCase.shipping_method),
      shipping_date: shippingDate,
      complaint_date: complaintDate,
      defect_items: emptyToNull(nextCase.defect_items),
      defect_description: emptyToNull(nextCase.defect_description),
      solution: emptyToNull(nextCase.solution),
      solved_date: solvedDate,
    });

    return { ok: true };
  }

  async getAdminView() {
    const { complaintTypes, solutionTypes } = await this.getLookupRows();
    return {
      complaintTypes: complaintTypes.map((row) => row.toJSON()),
      solutionTypes: solutionTypes.map((row) => row.toJSON()),
    };
  }

  async addComplaintType(name) {
    const sanitized = sanitizeText(name);
    if (!sanitized) {
      return { ok: false, message: 'Complaint type name is required.' };
    }

    const existing = await ct.ComplaintType.findOne({ where: { name: sanitized } });
    if (existing) {
      return { ok: false, message: 'Complaint type already exists.' };
    }

    try {
      await ct.ComplaintType.create({ name: sanitized });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        return { ok: false, message: 'Complaint type already exists.' };
      }
      throw error;
    }
    return { ok: true, message: 'Complaint type added.' };
  }

  async deleteComplaintType(id) {
    await ct.ComplaintType.destroy({ where: { id } });
    return { ok: true, message: 'Complaint type deleted.' };
  }

  async addSolutionType(name) {
    const sanitized = sanitizeText(name);
    if (!sanitized) {
      return { ok: false, message: 'Solution type name is required.' };
    }

    const existing = await ct.SolutionType.findOne({ where: { name: sanitized } });
    if (existing) {
      return { ok: false, message: 'Solution type already exists.' };
    }

    try {
      await ct.SolutionType.create({ name: sanitized });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') {
        return { ok: false, message: 'Solution type already exists.' };
      }
      throw error;
    }
    return { ok: true, message: 'Solution type added.' };
  }

  async deleteSolutionType(id) {
    await ct.SolutionType.destroy({ where: { id } });
    return { ok: true, message: 'Solution type deleted.' };
  }

  async getAnalyticsView() {
    const totalCases = await ct.Case.count();
    return { totalCases };
  }
}

module.exports = CaseTrackerService;
