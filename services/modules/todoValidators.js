const DEFECT_KEYWORDS = ['defect', 'damaged'];
const FINAL_STATUSES = ['Completed', 'Canceled'];

function hasDefectType(caseData) {
  if (!caseData.type) return false;
  const type = caseData.type.toLowerCase();
  return DEFECT_KEYWORDS.some(keyword => type.includes(keyword));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTodosForCase(caseData) {
  const todos = [];
  const now = new Date();
  const deadline = toDate(caseData.deadline);

  if (!deadline) {
    todos.push('Set a deadline so the case stays on track.');
  } else if (deadline < now && FINAL_STATUSES.indexOf(caseData.status) === -1) {
    todos.push('Deadline has expired. Update or extend it.');
  }

  if (!caseData.staff_in_charge) {
    todos.push('Assign a staff member to follow up.');
  }

  if (hasDefectType(caseData) && (!caseData.items || caseData.items.length === 0)) {
    todos.push('Add the affected item(s) for this defect.');
  }

  if (caseData.status === 'Ready for Resolution' && !caseData.solution) {
    todos.push('Select the planned resolution before closing.');
  }

  if (caseData.approvalStatus) {
    const required = caseData.approvalStatus.required || {};
    const granted = caseData.approvalStatus.granted || {};
    if (required.secondary && !granted.secondary) {
      todos.push('Secondary approval pending.');
    }
    if (required.leader && !granted.leader) {
      todos.push('Leader approval pending.');
    }
  }

  return todos;
}

function getClosureIssues(caseData, action) {
  const issues = [];
  const deadline = toDate(caseData.deadline);
  const now = new Date();

  if (action === 'complete') {
    if (caseData.status !== 'Completed') {
      issues.push('Set the status to Completed.');
    }
    if (!caseData.solution) {
      issues.push('Provide the final resolution.');
    }
    if (hasDefectType(caseData) && (!caseData.items || caseData.items.length === 0)) {
      issues.push('Add at least one affected item before completing the case.');
    }
  }

  if (action === 'cancel') {
    if (caseData.status !== 'Canceled') {
      issues.push('Set the status to Canceled.');
    }
    if (!caseData.cancel_reason) {
      issues.push('Enter a cancellation reason.');
    }
  }

  if (deadline && deadline > now) {
    issues.push('Clear the deadline or move it to today before closing.');
  }

  if (action === 'complete' && caseData.approvalStatus && Array.isArray(caseData.approvalStatus.missing)) {
    caseData.approvalStatus.missing.forEach(message => issues.push(message));
  }

  return issues;
}

module.exports = { getTodosForCase, getClosureIssues };
