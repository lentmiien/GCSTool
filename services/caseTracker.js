const fs = require('fs').promises; // Import the promise version of fs
const path = require('path'); // For working with file paths

const { ct, Op } = require('../sequelize');
const { getTodosForCase } = require('./modules/todoValidators');
const caseDataFolder = './data/case';

class CaseTrackerService {
  constructor() {
    this.order_numbers = [];
    this.case_numbers = [];
    ct.Case.findAll().then(d => {
      for (let i = 0; i < d.length; i++) {
        this.order_numbers.push(d[i].order);
        this.case_numbers.push(d[i].id);
      }
    });
  }

  async FetchAllOrderNumbers() {
    return {order_numbers: this.order_numbers, case_numbers: this.case_numbers};
  }
  
  async FetchOngoingCases() {
    const closedStatuses = ["Completed", "Canceled"];
    const cases_data = (await ct.Case.findAll()).filter(d => closedStatuses.indexOf(d.status) === -1);
    return cases_data;
  }
  
  async FetchCase(id) {
    try {
      const caseEntry = await ct.Case.findByPk(id);
      if (!caseEntry) throw new Error('Case not found');

      const comments = await ct.Comment.findAll({where: {case_id: id}});
      const items = await ct.Item.findAll({where: {case_id: id}});
      const assistant_records = await ct.AssistantRecord.findAll({where: {case_id: id}});
      const files = await ct.File.findAll({where: {case_id: id}});
      const refunds = await ct.Refund.findAll({where: {case_id: id}});
      const audits = await ct.AuditLog.findAll({where: {case_id: id}});
      const tickets = await ct.Zendesk.findAll({where: {case_id: id}});

      const caseJson = caseEntry.toJSON();
      const commentsJSON = comments.map(d => d.toJSON());
      const itemsJSON = items.map(d => d.toJSON());
      const assistant_recordsJSON = assistant_records.map(d => d.toJSON());
      const filesJSON = files.map(d => d.toJSON());
      const refundsJSON = refunds.map(d => d.toJSON());
      const auditsJSON = audits.map(d => d.toJSON());
      const ticketsJSON = tickets.map(d => d.toJSON());

      const processed_by = await ct.ProcessedBy.findAll({where: {case_id: id}});
      const staffs = [];
      for (let i = 0; i < processed_by.length; i++) {
        staffs.push(processed_by[i].staff);
      }

      const response = {
        ...caseJson,
        comments: commentsJSON,
        items: itemsJSON,
        assistant_records: assistant_recordsJSON,
        files: filesJSON,
        refunds: refundsJSON,
        audits: auditsJSON,
        tickets: ticketsJSON,
        processed_by: staffs.join('|'),
      };

      // Generate case history
      response.history = [];
      response.comments.forEach(d => {
        response.history.push({
          ts: d.timestamp,
          staff: d.staff,
          content: d.comment,
          audit: false,
        });
      });
      response.audits.forEach(d => {
        response.history.push({
          ts: d.timestamp,
          staff: d.staff,
          content: d.log,
          audit: true,
        });
      });
      response.history.sort((a,b) => {
        if (a.ts < b.ts) return 1;
        if (a.ts > b.ts) return -1;
        return 0;
      });

      return response
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async FetchAllItems() {
    try {
      // Get all items
      const items = await ct.Item.findAll();
      const itemCounts = {};
      for (let i = 0; i < items.length; i++) {
        itemCounts[items[i].item_code] = (itemCounts[items[i].item_code] || 0) + 1;
      }
      const keys = Object.keys(itemCounts);
      const itemArray = [];
      for (const key of keys) {
        itemArray.push({item_code: key, count: itemCounts[key]});
      }
      itemArray.sort((a,b) => {
        if (a.count > b.count) return -1;
        if (a.count < b.count) return 1;
        return 0;
      });
      return itemArray;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async FetchItemDetails(item_code) {
    try {
      // Get all items
      const items = await ct.Item.findAll({where:{item_code}});
      const fileIds = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].file_id) fileIds.push(items[i].file_id);
      }
      const files = await ct.File.findAll({where:{id:fileIds}});
      const fileMap = {};
      for (let i = 0; i < files.length; i++) {
        fileMap[files[i].id] = files[i].filename;
      }
      return {items, fileMap};
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async FetchAllRefunds() {
    try {
      // Get all active refunds
      const activeStatuses = ["Requested", "Processed", "Pending acceptance", "Pending processing"];
      const refunds = await ct.Refund.findAll({where:{status:activeStatuses}});
      const fileIds = [];
      for (let i = 0; i < refunds.length; i++) {
        if (refunds[i].file_id) fileIds.push(refunds[i].file_id);
      }
      const files = await ct.File.findAll({where:{id:fileIds}});
      const fileMap = {};
      for (let i = 0; i < files.length; i++) {
        fileMap[files[i].id] = files[i].filename;
      }
      return {refunds, fileMap};
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async BatchUpdateRefunds(inputs, staff) {
    try {
      const d = new Date();
      for (const i of inputs) {
        let hasChanges = false;
        const changes = {};
        const currentRefund = await ct.Refund.findByPk(i.id);

        // Newly processed refunds (send refund request to process actual refund)
        if (i.transaction_id) {
          hasChanges = true;
          changes['processed_date'] = {before: currentRefund.processed_date, after: d};
          changes['transaction_id'] = {before: currentRefund.transaction_id, after: i.transaction_id};
          changes['status'] = {before: currentRefund.status, after: "Processed"};
          currentRefund.processed_date = d;
          currentRefund.transaction_id = i.transaction_id;
          currentRefund.status = "Processed";
        }

        // If has a valida date in `completed_date`, set completed date and status to `completed` value, of "Completed" if `completed` has no value
        if (i.completed_date && i.completed_date.length > 0) {
          hasChanges = true;
          const completedDate = new Date(i.completed_date);
          const newStatus = i.completed && i.completed.length > 0 ? i.completed : "Completed";
          changes['completed_date'] = {before: currentRefund.completed_date, after: completedDate};
          changes['status'] = {before: currentRefund.status, after: newStatus};
          currentRefund.completed_date = completedDate;
          currentRefund.status = newStatus;
        }

        // If already has a completed date, then just update status to `completed` value, of ignore if `completed` has no value
        if (currentRefund.completed_date && i.completed && i.completed.length > 0) {
          hasChanges = true;
          const newStatus = i.completed;
          changes['status'] = {before: currentRefund.status, after: newStatus};
          currentRefund.status = newStatus;
        }

        if (hasChanges) {
          await currentRefund.save();
          await this.Audit(currentRefund.case_id, staff, "Processed Refund", changes);
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async FetchUserProfile(customer_id) {
    // Return 2D array, with a claim type for each row, and solution for each column, including "pending" if solution has not yet been set
    const output = [];
    const row_labels = [];
    const col_labels = [];
    const customer_cases = await ct.Case.findAll({where:{customer_id}});

    for (const c of customer_cases) {
      let row_index = row_labels.indexOf(c.type);
      const sol = c.solution && c.solution.length > 0 ? c.solution : "pending";
      let col_index = col_labels.indexOf(sol);
      if (row_index === -1) {
        row_index = row_labels.length;
        row_labels.push(c.type);
        output.push([]);
        for (let i = 0; i < col_labels.length; i++) {
          output[row_index].push(0);
        }
      }
      if (col_index === -1) {
        col_index = col_labels.length;
        col_labels.push(sol);
        for (let i = 0; i < row_labels.length; i++) {
          output[i].push(0);
        }
      }
      output[row_index][col_index]++;
    }

    return {output, row_labels, col_labels};
  }

  async FetchAudit() {
    const audits = await ct.AuditLog.findAll();
    return audits;
  }
  
  async AddCase(order, customer_id, tracking, shipping_method, shipped_date, type, country, deadline, staff_in_charge, status) {
    try {
      const newCase = await ct.Case.create({
        order,
        customer_id,
        tracking,
        shipping_method,
        shipped_date,
        type,
        country,
        deadline,
        staff_in_charge,
        status,
      });

      await this.ProcessedBy(newCase.id, staff_in_charge);
      await this.Audit(newCase.id, staff_in_charge, "Created case", {case_id: newCase.id, order, type, status});

      this.order_numbers.push(order);
      this.case_numbers.push(newCase.id);

      return newCase.id;
    } catch (error) {
      console.error("Error creating audit log:", error);
      throw error;
    }
  }
  
  async AddComment(case_id, staff, comment) {
    try {
      const newComment = await ct.Comment.create({
        case_id,
        staff,
        comment,
      });

      await this.ProcessedBy(case_id, staff);
      await this.Audit(case_id, staff, "Added Comment", {comment_id: newComment.id, comment});

      return newComment.id;
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  }
  
  async AddItem(id, case_id, file_id, item_code, defect, item_cost, staff) {
    try {
      const currentItem = await ct.Item.findByPk(id);
      if (currentItem) {
        // Update
        const changes = {};
        if (file_id && currentItem.file_id != file_id) {
          changes['file_id'] = {before: currentItem.file_id, after: file_id};
          currentItem.file_id = file_id;
        }
        if (currentItem.item_code != item_code) {
          changes['item_code'] = {before: currentItem.item_code, after: item_code};
          currentItem.item_code = item_code;
        }
        if (currentItem.defect != defect) {
          changes['defect'] = {before: currentItem.defect, after: defect};
          currentItem.defect = defect;
        }
        if (currentItem.item_cost != item_cost) {
          changes['item_cost'] = {before: currentItem.item_cost, after: item_cost};
          currentItem.item_cost = item_cost;
        }
        await currentItem.save();

        await this.Audit(case_id, staff, "Update Item", changes);
        await this.ProcessedBy(case_id, staff);

        return currentItem.id;
      } else {
        // Create
        const newItem = await ct.Item.create({
          case_id,
          file_id,
          item_code,
          defect,
          item_cost,
        });

        await this.Audit(case_id, staff, "Created Item", {item_id: newItem.id, item_code, defect});
        await this.ProcessedBy(case_id, staff);

        return newItem.id;
      }
    } catch (error) {
      console.error("Error creating/updating item:", error);
      throw error;
    }
  }
  
  async SetAssistantRecord(case_id, order, tracking, type, item_cost, shipping_cost, gst_cost, status, staff) {
    try {
      const currentRecord = await ct.AssistantRecord.findAll({where:{case_id, order}});
      if (currentRecord.length > 0) {
        // Update
        const changes = {};
        if (currentRecord[0].tracking != tracking) {
          changes['tracking'] = {before: currentRecord[0].tracking, after: tracking};
          currentRecord[0].tracking = tracking;
        }
        if (currentRecord[0].type != type) {
          changes['type'] = {before: currentRecord[0].type, after: type};
          currentRecord[0].type = type;
        }
        if (currentRecord[0].item_cost != item_cost) {
          changes['item_cost'] = {before: currentRecord[0].item_cost, after: item_cost};
          currentRecord[0].item_cost = item_cost;
        }
        if (currentRecord[0].shipping_cost != shipping_cost) {
          changes['shipping_cost'] = {before: currentRecord[0].shipping_cost, after: shipping_cost};
          currentRecord[0].shipping_cost = shipping_cost;
        }
        if (currentRecord[0].gst_cost != gst_cost) {
          changes['gst_cost'] = {before: currentRecord[0].gst_cost, after: gst_cost};
          currentRecord[0].gst_cost = gst_cost;
        }
        if (currentRecord[0].status != status) {
          changes['status'] = {before: currentRecord[0].status, after: status};
          currentRecord[0].status = status;
        }
        await currentRecord[0].save();

        await this.ProcessedBy(currentRecord[0].case_id, staff);
        await this.Audit(currentRecord[0].case_id, staff, "Update Assistant Record", changes);

        return currentRecord[0].id;
      } else {
        // Create
        const newRecord = await ct.AssistantRecord.create({
          case_id,
          order,
          tracking,
          type,
          item_cost,
          shipping_cost,
          gst_cost,
          status,
        });

        await this.Audit(case_id, staff, "Create Assistant Record", {assistant_record_id: newRecord.id, order, type, status});
        await this.ProcessedBy(case_id, staff);

        return newRecord.id;
      }
    } catch (error) {
      console.error("Error creating/updating assistant record:", error);
      throw error;
    }
  }
  
  async AddFile(case_id, type, filename, staff, File) {
    try {
      const newFile = await ct.File.create({
        case_id,
        type,
        filename,
      });

      await this.ProcessedBy(case_id, staff);
      await this.Audit(case_id, staff, "Created File", {file_id: newFile.id, type, filename});

      const uploadPath = caseDataFolder + '/' + filename;
      await File.mv(uploadPath);

      return newFile.id;
    } catch (error) {
      console.error("Error creating file:", error);
      throw error;
    }
  }
  
  async AddRefund(id, case_id, file_id, order, type, amount, currency, jpy_amount, status, method, refund_details, staff) {
    try {
      const currentRefund = await ct.Refund.findByPk(id);
      if (currentRefund) {
        // Update
        const changes = {};
        if (file_id && currentRefund.file_id != file_id) {
          changes['file_id'] = {before: currentRefund.file_id, after: file_id};
          currentRefund.file_id = file_id;
        }
        if (currentRefund.order != order) {
          changes['order'] = {before: currentRefund.order, after: order};
          currentRefund.order = order;
        }
        if (currentRefund.amount != amount) {
          changes['amount'] = {before: currentRefund.amount, after: amount};
          currentRefund.amount = amount;
        }
        if (currentRefund.currency != currency) {
          changes['currency'] = {before: currentRefund.currency, after: currency};
          currentRefund.currency = currency;
        }
        if (currentRefund.jpy_amount != jpy_amount) {
          changes['jpy_amount'] = {before: currentRefund.jpy_amount, after: jpy_amount};
          currentRefund.jpy_amount = jpy_amount;
        }
        if (currentRefund.refund_details != refund_details) {
          changes['refund_details'] = {before: currentRefund.refund_details, after: refund_details};
          currentRefund.refund_details = refund_details;
        }
        await currentRefund.save();

        await this.ProcessedBy(case_id, staff);
        await this.Audit(case_id, staff, "Updated Refund", changes);

        return currentRefund.id;
      } else {
        // Create
        const newRefund = await ct.Refund.create({
          case_id,
          file_id,
          order,
          type,
          amount,
          currency,
          jpy_amount,
          status,
          method,
          refund_details,
        });

        await this.ProcessedBy(case_id, staff);
        await this.Audit(case_id, staff, "Create Refund", {refund_id: newRefund.id, order, type, amount, currency, jpy_amount, status, method, refund_details});

        return newRefund.id;
      }
    } catch (error) {
      console.error("Error creating/updating refund:", error);
      throw error;
    }
  }

  async CancelRefund(id, case_id, staff) {
    try {
      const currentRefund = await ct.Refund.findByPk(id);
      if (currentRefund) {
        // Update
        const changes = {};
        changes['status'] = {before: currentRefund.status, after: "Canceled (correction)"};
        currentRefund.status = "Canceled (correction)";
        await currentRefund.save();

        await this.ProcessedBy(case_id, staff);
        await this.Audit(case_id, staff, "Canceled Refund", changes);

        return currentRefund.id;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error cancelling refund:", error);
      throw error;
    }
  }

  async AddTicket(case_id, ticket, staff) {
    try {
      // Don't create duplicates if ticket already exist for case (same ticket may be added to other cases)
      const currentTicket = await ct.Zendesk.findAll({where:{case_id, ticket}});
      if (currentTicket.length > 0) return currentTicket[0].id;

      const newTicket = await ct.Zendesk.create({
        case_id,
        ticket,
      });

      await this.ProcessedBy(case_id, staff);
      await this.Audit(case_id, staff, "Added Zendesk ticket", {ticket});

      return newTicket.id;
    } catch (error) {
      console.error("Error adding Zendesk ticket:", error);
      throw error;
    }
  }

  async TakeCase(id, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.staff_in_charge != staff) {
          await this.ProcessedBy(id, staff);
          await this.Audit(id, staff, "Updated Staff In Charge", {staff_in_charge: {before: currentCase.staff_in_charge, after: staff}});
          currentCase.staff_in_charge = staff;
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error taking case:", error);
      throw error;
    }
  }

  async SetDeadline(id, deadline, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.deadline != deadline) {
          await this.ProcessedBy(id, staff);
          await this.Audit(id, staff, "Updated Deadline", {deadline: {before: currentCase.deadline, after: deadline}});
          currentCase.deadline = deadline;
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error updating deadline:", error);
      throw error;
    }
  }

  async SetType(id, type, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.type != type) {
          await this.ProcessedBy(id, staff);
          await this.Audit(id, staff, "Updated Type", {type: {before: currentCase.type, after: type}});
          currentCase.type = type;
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error updating type:", error);
      throw error;
    }
  }

  async SetStatus(id, status, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.status != status) {
          await this.ProcessedBy(id, staff);
          if (status === "Completed" || status === "Canceled") {
            const ended = new Date();
            await this.Audit(id, staff, "Closed case", {
              ended: {before: null, after: ended},
              status: {before: currentCase.status, after: status},
            });
            currentCase.ended = ended;
            currentCase.status = status;
          } else {
            await this.Audit(id, staff, "Updated Status", {status: {before: currentCase.status, after: status}});
            currentCase.status = status;
          }
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      throw error;
    }
  }

  async SetSolution(id, solution, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.solution != solution) {
          await this.ProcessedBy(id, staff);
          await this.Audit(id, staff, "Updated Solution", {solution: {before: currentCase.solution, after: solution}});
          currentCase.solution = solution;
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error updating solution:", error);
      throw error;
    }
  }

  async SetCancelReason(id, cancel_reason, staff) {
    try {
      const currentCase = await ct.Case.findByPk(id);
      if (currentCase) {
        if (currentCase.cancel_reason != cancel_reason) {
          await this.ProcessedBy(id, staff);
          await this.Audit(id, staff, "Set Cancel Reason", {cancel_reason: {before: currentCase.cancel_reason, after: cancel_reason}});
          currentCase.cancel_reason = cancel_reason;
          await currentCase.save();
        }
      }
    } catch (error) {
      console.error("Error setting cancel reason:", error);
      throw error;
    }
  }

  async CreateToDoList(id = null, staff = null) {
    try {
      const output = {};
      if (id) {
        output[id] = await this.ToDoList(id);
      }
      if (staff) {
        const relevantCases = await ct.Case.findAll({where:{staff_in_charge: staff}});
        for (let i = 0; i < relevantCases.length; i++) {
          if (!(relevantCases[i].id === id || relevantCases[i].status === "Completed" || relevantCases[i].status === "Canceled")) {
            output[relevantCases[i].id] = await this.ToDoList(relevantCases[i].id);
          }
        }
      }
      return output;
    } catch (error) {
      console.error("Error generating ToDo list:", error);
      throw error;
    }
  }

  async ToDoList(caseId) {
    try {
      const caseData = await this.FetchCase(caseId);
      // Use the helper to generate todos based on the solution (or lack thereof) 
      const todos = getTodosForCase(caseData);
      return todos;
    } catch (error) {
      console.error("Error creating ToDo list:", error);
      throw error;
    }
  }

  async getExpiredFiles() {
    try {
      // Calculate the date 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
      // Query the database for records older than 6 months
      const expiredFiles = await ct.File.findAll({
        where: {
          uploaded_date: {
            [Op.lt]: sixMonthsAgo, // `uploaded_date` less than 6 months ago
          },
        },
        attributes: ['id', 'filename'], // Only return `id` and `filename` fields
      });
  
      // Map and return the results as an array of objects with id and filename
      return expiredFiles.map((file) => ({
        id: file.id,
        filename: file.filename,
      }));
    } catch (error) {
      console.error('Error fetching expired files:', error);
      throw error; // Throw the error to be caught by the caller
    }
  }

  async deleteImagesFromStorage(filenameArray) {
    try {
      // Iterate over the filenames and delete each file
      for (const filename of filenameArray) {
        const filePath = path.join(caseDataFolder, filename); // Construct the full path
        console.log(`Deleting file: ${filePath}`); // Log the file being deleted
        
        // Attempt to delete the file
        try {
          await fs.unlink(filePath); // Remove the file
          console.log(`Successfully deleted: ${filePath}`);
        } catch (error) {
          if (error.code === 'ENOENT') {
            // File doesn't exist, log and continue
            console.warn(`File not found, skipping: ${filePath}`);
          } else {
            // Other errors should be thrown
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error deleting files from storage:', error);
      throw error; // Throw error to be handled by the calling function
    }
  }

  async markFilesAsExpired(ids) {
    try {
      // Update the records with the provided IDs
      const result = await ct.File.update(
        { filename: 'EXPIRED' }, // Set filename to "EXPIRED"
        {
          where: {
            id: {
              [Op.in]: ids, // Match only the records with the given IDs
            },
          },
        }
      );
  
      return result[0]; // Sequelize returns an array where the first element is the number of affected rows
    } catch (error) {
      console.error('Error marking files as expired:', error);
      throw error; // Throw the error to be caught by the caller
    }
  }
  
  async ProcessedBy(id, staff) {
    try {
      const exist = await ct.ProcessedBy.findAll({where:{case_id: id, staff}});
      if (exist.length === 0) {
        await ct.ProcessedBy.create({
          case_id: id,
          staff,
        });
      }
    } catch (error) {
      console.error("Error adding processed by:", error);
      throw error;
    }
  }
  
  async Audit(id, staff, action, metadata = {}) {
    await ct.AuditLog.create({
      case_id: id,
      staff,
      log: `${action} by ${staff} on case: ${id}`,
      metadata: JSON.stringify(metadata),
    });
  }

  // For resetting database during testing
  async ClearDatabase() {
    await ct.Case.destroy({ where: {}, truncate: true });
    await ct.ProcessedBy.destroy({ where: {}, truncate: true });
    await ct.Comment.destroy({ where: {}, truncate: true });
    await ct.Item.destroy({ where: {}, truncate: true });
    await ct.AssistantRecord.destroy({ where: {}, truncate: true });
    await ct.File.destroy({ where: {}, truncate: true });
    await ct.Refund.destroy({ where: {}, truncate: true });
    await ct.AuditLog.destroy({ where: {}, truncate: true });
  }
}

module.exports = CaseTrackerService;
