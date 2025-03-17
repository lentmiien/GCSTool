const typesRequiringItems = ["Defect", "Damaged in shipment", "Delivered but missing content"];
const caseCompleteStatuses = ["Pending completion", "Completed", "Pending cancellation", "Canceled"];
const statusesRequiringSolution = ["Offered solution to customer", "Processing replacement", "Processing return", "Processing refund", "Pending completion", "Completed", "Pending cancellation", "Canceled"];
const activeRefundStatuses = ["Requested", "Processed", "Pending acceptance", "Pending processing", "Completed", "Completed (pending)"];

// Validators for cases that have NO solution yet
const typeValidators = [
  // Validate deadline
  (caseData) => {
    if (!caseData.deadline) {
      return "Deadline not set!!";
    } else if (caseData.deadline < new Date()) {
      return "Deadline has expired!!";
    }
    return null;
  },
  // Validate that for certain types, items are required
  (caseData) => {
    if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
      return "Missing details about affected items!";
    }
    return null;
  },
  // If case has reached offered solution stage (or later) and no solution is set.
  (caseData) => {
    if (!caseData.solution && statusesRequiringSolution.indexOf(caseData.status) !== -1) {
      return "No solution specified – please set a solution for the case!!";
    } else if (!caseData.solution) {
      return "Please confirm/investigate the issue and specify a solution";
    }
    return null;
  }
];

// Validators for cases that already have a specific solution
const solutionValidators = {
  Exchange: [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items are provided if required by type
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing damaged or defective item details!";
      }
      return null;
    },
    // Validate that an Exchange should have both a replacement and return assistant record
    (caseData) => {
      let hasReplacement = false;
      let hasReturn = false;
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return "Missing assistant records for Exchange solution!";
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          hasReplacement = true;
          if (!record.tracking || record.tracking.length === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing tracking number`);
          }
          if (record.item_cost === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing item cost`);
          }
          if (record.shipping_cost === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing shipping cost`);
          }
          if (!(record.status === "Delivered" || record.status === "Lost")) {
            recordTodos.push(`Replacement record ${record.order}: shipping status not final`);
          }
        } else if (record.type === "Return") {
          hasReturn = true;
          if (!record.tracking || record.tracking.length === 0) {
            recordTodos.push(`Return record ${record.order}: missing tracking number`);
          }
          if (record.item_cost === 0) {
            recordTodos.push(`Return record ${record.order}: missing item cost`);
          }
          if (record.shipping_cost === 0) {
            recordTodos.push(`Return record ${record.order}: missing shipping cost`);
          }
          if (!(record.status === "Delivered" || record.status === "Lost")) {
            recordTodos.push(`Return record ${record.order}: shipping status not final`);
          }
        }
      }
      if (!hasReplacement) {
        recordTodos.push("An exchange requires a replacement record!");
      }
      if (!hasReturn) {
        recordTodos.push("An exchange requires a return record!");
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is a refund of the return shipping for each return record
    (caseData) => {
      const returnRecords = [];
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Return") {
          returnRecords.push(record.order);
        }
      }
      if (returnRecords.length > 0) {
        if (!caseData.refunds || caseData.refunds.length === 0) {
          return `All ${returnRecords.length} return records are missing refund entries for shipping cost!`;
        }
        for (const order of returnRecords) {
          let refunded = false;
          for (const refund of caseData.refunds) {
            if (order === refund.order && activeRefundStatuses.indexOf(refund.status) >= 0) {
              refunded = true;
            }
          }
          if (!refunded) {
            recordTodos.push(`Return record ${order}: missing refund for return shipping`);
          }
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
  "Return for refund": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Return for refund should only have a return record without any replacement record
    (caseData) => {
      let hasReturn = false;
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return "Missing assistant records for return solution!";
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          recordTodos.push(`Replacement record ${record.order} should not be present for Return for refund!`);
        } else if (record.type === "Return") {
          hasReturn = true;
          if (!record.tracking || record.tracking.length === 0) {
            recordTodos.push(`Return record ${record.order}: missing tracking number`);
          }
          if (record.item_cost === 0) {
            recordTodos.push(`Return record ${record.order}: missing item cost`);
          }
          if (record.shipping_cost === 0) {
            recordTodos.push(`Return record ${record.order}: missing shipping cost`);
          }
          if (!(record.status === "Delivered" || record.status === "Lost")) {
            recordTodos.push(`Return record ${record.order}: shipping status not final`);
          }
        }
      }
      if (!hasReturn) {
        recordTodos.push("A Return for refund solution requires a return record!");
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is a refund of the return shipping for each return record, and that there is a refund for the returned goods after delivery
    (caseData) => {
      const returnRecords = [];
      let originalRecord = caseData.order;
      let hasNonDeliveredReturns = false;
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Return") {
          returnRecords.push(record.order);
          if (!(record.status === "Delivered" || record.status === "Lost")) {
            hasNonDeliveredReturns = true;
          }
        } else if (record.type === "Original") {
          originalRecord = record.order;
        }
      }
      if (returnRecords.length > 0) {
        if (!caseData.refunds || caseData.refunds.length === 0) {
          return `All ${returnRecords.length} return records are missing refund entries for shipping cost!`;
        }
        for (const order of returnRecords) {
          let refunded = false;
          for (const refund of caseData.refunds) {
            if (order === refund.order && activeRefundStatuses.indexOf(refund.status) >= 0) {
              refunded = true;
            }
          }
          if (!refunded) {
            recordTodos.push(`Return record ${order}: missing refund for return shipping`);
          }
        }
      }
      if (!hasNonDeliveredReturns) {
        if (!caseData.refunds || caseData.refunds.length === 0) {
          return `Returned goods is missing a refund entry!`;
        }
        let refunded = false;
        for (const refund of caseData.refunds) {
          if (originalRecord === refund.order && activeRefundStatuses.indexOf(refund.status) >= 0) {
            refunded = true;
          }
        }
        if (!refunded) {
          recordTodos.push(`Original record ${originalRecord}: missing refund for returned goods`);
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
  "Send replacement": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Send Replacement should only have a replacement record without any return record
    (caseData) => {
      let hasReplacement = false;
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return "Missing assistant records for replacement solution!";
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          hasReplacement = true;
          if (!record.tracking || record.tracking.length === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing tracking number`);
          }
          if (record.item_cost === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing item cost`);
          }
          if (record.shipping_cost === 0) {
            recordTodos.push(`Replacement record ${record.order}: missing shipping cost`);
          }
          if (!(record.status === "Delivered" || record.status === "Lost")) {
            recordTodos.push(`Replacement record ${record.order}: shipping status not final`);
          }
        } else if (record.type === "Return") {
          recordTodos.push(`Return record ${record.order} should not be present for Send replacement!`);
        }
      }
      if (!hasReplacement) {
        recordTodos.push("A Send replacement solution requires a replacement record!");
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
  "Compensation": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Compensation don't have any replacement or return records
    (caseData) => {
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          recordTodos.push(`Replacement record ${record.order} should not be present for Compensation!`);
        } else if (record.type === "Return") {
          recordTodos.push(`Return record ${record.order} should not be present for Compensation!`);
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is a refund for the compensation
    (caseData) => {
      let hasCompensation = false;
      const validCompensationTypes = ["Pre-owned compensation", "JP compensation", "DHL compensation", "AIT compensation", "AmiAmi compensation"];
      if (!caseData.refunds || caseData.refunds.length === 0) {
        return "Missing refund for compensation solution!";
      }
      for (const refund of caseData.refunds) {
        if (activeRefundStatuses.indexOf(refund.status) === -1) continue;
        if (validCompensationTypes.indexOf(refund.type) >= 0) hasCompensation = true;
      }
      if (!hasCompensation) {
        return "Missing valid refund for compensation solution!";
      }
      return null;
    },
  ],
  "Refund missing items": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Refund missing items don't have any replacement or return records
    (caseData) => {
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          recordTodos.push(`Replacement record ${record.order} should not be present for Refund missing items!`);
        } else if (record.type === "Return") {
          recordTodos.push(`Return record ${record.order} should not be present for Refund missing items!`);
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is a refund for the refund
    (caseData) => {
      let hasRefund = false;
      const validRefundTypes = ["Refund missing item"];
      if (!caseData.refunds || caseData.refunds.length === 0) {
        return "Missing refund for refund of missing item solution!";
      }
      for (const refund of caseData.refunds) {
        if (activeRefundStatuses.indexOf(refund.status) === -1) continue;
        if (validRefundTypes.indexOf(refund.type) >= 0) hasRefund = true;
      }
      if (!hasRefund) {
        return "Missing valid refund for refund of missing item solution!";
      }
      return null;
    },
  ],
  "Delivered": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Delivered don't have any replacement or return records
    (caseData) => {
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          recordTodos.push(`Replacement record ${record.order} should not be present for Delivered!`);
        } else if (record.type === "Return") {
          recordTodos.push(`Return record ${record.order} should not be present for Delivered!`);
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is no refunds
    (caseData) => {
      const recordTodos = [];
      if (!caseData.refunds || caseData.refunds.length === 0) {
        return null;
      }
      for (const refund of caseData.refunds) {
        if (activeRefundStatuses.indexOf(refund.status) >= 0) recordTodos.push(`${refund.type} refund ${refund.order} must be canceled!`);
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
  "Assistance no longer needed": [
    // Validate deadline
    (caseData) => {
      if (caseCompleteStatuses.indexOf(caseData.status) === -1) {
        if (!caseData.deadline) {
          return "Deadline not set!!";
        } else if (caseData.deadline < new Date()) {
          return "Deadline has expired!!";
        }
      }
      return null;
    },
    // Check items
    (caseData) => {
      if (typesRequiringItems.indexOf(caseData.type) !== -1 && (!caseData.items || caseData.items.length === 0)) {
        return "Missing details about affected items!";
      }
      return null;
    },
    // Validate that Assistance no longer needed don't have any replacement or return records
    (caseData) => {
      const recordTodos = [];
      if (!caseData.assistant_records || caseData.assistant_records.length === 0) {
        return null;
      }
      for (const record of caseData.assistant_records) {
        if (record.status === "Canceled") continue;
        if (record.type === "Replacement") {
          recordTodos.push(`Replacement record ${record.order} should not be present for Assistance no longer needed!`);
        } else if (record.type === "Return") {
          recordTodos.push(`Return record ${record.order} should not be present for Assistance no longer needed!`);
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Verify that there is no refunds
    (caseData) => {
      const recordTodos = [];
      if (!caseData.refunds || caseData.refunds.length === 0) {
        return null;
      }
      for (const refund of caseData.refunds) {
        if (activeRefundStatuses.indexOf(refund.status) >= 0) recordTodos.push(`${refund.type} refund ${refund.order} must be canceled!`);
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
};

// Validators for cases that already have a specific solution
const endStatusValidators = {
  "Completed": [
    // Validate deadline
    (caseData) => {
      const recordTodos = [];
      if (caseData.deadline) {
        if (caseData.deadline < new Date()) {
          recordTodos.push("Deadline has expired!!");
        }
        recordTodos.push("Clear deadline when done!");
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Validate that all assistant recodrs are "completed" or "canceled"
    (caseData) => {
      const recordTodos = [];
      const validEndStatuses = ["Delivered", "Lost", "Canceled"];
      if (caseData.assistant_records && caseData.assistant_records.length > 0) {
        for (const record of caseData.assistant_records) {
          if (record.type === "Replacement" || record.type === "Return") {
            if (validEndStatuses.indexOf(record.status) === -1) {
              recordTodos.push(`${record.type} record ${record.order} must be completed/closed!`);
            }
          }
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Validate that all refunds are "completed" or "canceled"
    (caseData) => {
      const recordTodos = [];
      const validEndStatuses = ["Completed", "Canceled", "Expired", "Rejected"];
      if (caseData.refunds && caseData.refunds.length > 0) {
        for (const refund of caseData.refunds) {
          if (validEndStatuses.indexOf(refund.status) === -1) {
            recordTodos.push(`Refund ${refund.order} must be completed/closed!`);
          }
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
  "Canceled": [
    // Validate deadline
    (caseData) => {
      const recordTodos = [];
      if (caseData.deadline) {
        if (caseData.deadline < new Date()) {
          recordTodos.push("Deadline has expired!!");
        }
        recordTodos.push("Clear deadline when done!");
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Validate that all assistant recodrs are "canceled"
    (caseData) => {
      const recordTodos = [];
      const validEndStatuses = ["Canceled"];
      if (caseData.assistant_records && caseData.assistant_records.length > 0) {
        for (const record of caseData.assistant_records) {
          if (record.type === "Replacement" || record.type === "Return") {
            if (validEndStatuses.indexOf(record.status) === -1) {
              recordTodos.push(`${record.type} record ${record.order} must be canceled!`);
            }
          }
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Validate that all refunds are "canceled"
    (caseData) => {
      const recordTodos = [];
      const validEndStatuses = ["Canceled (correction)", "Canceled", "Expired", "Rejected"];
      if (caseData.refunds && caseData.refunds.length > 0) {
        for (const refund of caseData.refunds) {
          if (validEndStatuses.indexOf(refund.status) === -1) {
            recordTodos.push(`Refund ${refund.order} must be canceled!`);
          }
        }
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
    // Validate that a cancel reason has been set
    (caseData) => {
      const recordTodos = [];
      if (!(caseData.cancel_reason && caseData.cancel_reason.length > 0)) {
        recordTodos.push(`Please set a cancel reason for the case!`);
      }
      return recordTodos.length ? recordTodos.join(" | ") : null;
    },
  ],
};

// Exposed utility: Generate todos for a given case data object.
function getTodosForCase(caseData) {
  const todos = [];

  // First, apply the type-based validations if no solution is specified:
  if (!caseData.solution) {
    typeValidators.forEach((validator) => {
      const result = validator(caseData);
      if (result) {
        if (result.indexOf(" | ") >= 0) {
          result.split(" | ").forEach(d => todos.push(d));
        } else {
          todos.push(result);
        }
      }
    });
  } else {
    // In the event a solution is set, run the solution-based validations.
    const validators = solutionValidators[caseData.solution];
    if (!validators) {
      todos.push(`No validations have been defined for solution "${caseData.solution}"!`);
    } else {
      validators.forEach((validator) => {
        const result = validator(caseData);
        if (result) {
          if (result.indexOf(" | ") >= 0) {
            result.split(" | ").forEach(d => todos.push(d));
          } else {
            todos.push(result);
          }
        }
      });
    }
  }

  // Check end status validators, status: "Pending completion", "Completed", "Pending cancellation", "Canceled"
  if (caseData.status === "Pending completion" || caseData.status === "Completed") {
    const validators = endStatusValidators["Completed"];
    validators.forEach((validator) => {
      const result = validator(caseData);
      if (result) {
        if (result.indexOf(" | ") >= 0) {
          result.split(" | ").forEach(d => todos.push(d));
        } else {
          todos.push(result);
        }
      }
    });
  }
  if (caseData.status === "Pending cancellation" || caseData.status === "Canceled") {
    const validators = endStatusValidators["Canceled"];
    validators.forEach((validator) => {
      const result = validator(caseData);
      if (result) {
        if (result.indexOf(" | ") >= 0) {
          result.split(" | ").forEach(d => todos.push(d));
        } else {
          todos.push(result);
        }
      }
    });
  }

  return todos;
}

module.exports = { getTodosForCase };
