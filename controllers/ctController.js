const CaseTrackerService = require('../services/caseTracker');
const caseTracker = new CaseTrackerService();

function getStaff(req) {
  return req.user && req.user.userid ? req.user.userid : 'Guest';
}

function baseViewModel(extra = {}) {
  const metadata = caseTracker.getMetadata();
  return {
    metadata,
    templates: caseTracker.getTemplates(),
    ...extra,
  };
}

exports.dashboard = async (req, res, next) => {
  try {
    const days = 3;
    const casesDueSoon = await caseTracker.getCasesDueSoon(days);
    const viewModel = baseViewModel({
      casesDueSoon,
      days,
      message: req.query.message,
    });
    res.render('ct/ct', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { query } = req.body;
    const result = await caseTracker.search(query);

    switch (result.type) {
      case 'case':
        return res.redirect(`/ct/case/${result.id}`);
      case 'customer':
        return res.redirect(`/ct/customer/${encodeURIComponent(result.customerId)}`);
      case 'item':
        return res.redirect(`/ct/item/${encodeURIComponent(result.itemCode)}`);
      case 'newCase':
        return res.redirect(`/ct/case/new?order=${encodeURIComponent(result.order)}`);
      case 'empty':
        return res.redirect('/ct?message=' + encodeURIComponent('Enter a value to search.'));
      default:
        return res.redirect('/ct?message=' + encodeURIComponent('No matching case, customer, or item found.'));
    }
  } catch (error) {
    next(error);
  }
};

exports.newCaseForm = (req, res) => {
  const order = req.query.order || '';
  const staff = getStaff(req);
  const selectedTemplate = req.query.template || '';
  const viewModel = baseViewModel({
    order,
    staff,
    selectedTemplate,
  });
  res.render('ct/newCase', viewModel);
};

exports.createCase = async (req, res, next) => {
  try {
    const staff = getStaff(req);
    await caseTracker.createCase(req.body, staff);
    const searchResult = await caseTracker.search(req.body.order);
    if (searchResult.type === 'case') {
      return res.redirect(`/ct/case/${searchResult.id}`);
    }
    return res.redirect('/ct');
  } catch (error) {
    next(error);
  }
};

exports.caseDetail = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const caseDetails = await caseTracker.getCase(caseId);
    if (!caseDetails) {
      return res.status(404).render('error', { message: 'Case not found' });
    }

    const viewModel = baseViewModel({
      caseDetails,
      success: req.query.updated,
    });
    res.render('ct/case', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.updateCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const staff = getStaff(req);
    await caseTracker.updateCase(caseId, req.body, staff);
    res.redirect(`/ct/case/${caseId}?updated=1`);
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const staff = getStaff(req);
    await caseTracker.addComment(caseId, staff, req.body.comment);
    res.redirect(`/ct/case/${caseId}`);
  } catch (error) {
    next(error);
  }
};

exports.upsertItem = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const staff = getStaff(req);
    const payload = {
      id: req.body.item_id || null,
      item_code: req.body.item_code,
      defect: req.body.item_defect,
      item_cost: req.body.item_cost,
    };
    await caseTracker.addOrUpdateItem(caseId, payload, staff);
    res.redirect(`/ct/case/${caseId}`);
  } catch (error) {
    next(error);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    const staff = getStaff(req);
    await caseTracker.deleteItem(caseId, itemId, staff);
    res.redirect(`/ct/case/${caseId}`);
  } catch (error) {
    next(error);
  }
};

exports.confirmClose = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const action = req.params.action === 'cancel' ? 'cancel' : 'complete';
    const caseDetails = await caseTracker.getCase(caseId);
    if (!caseDetails) {
      return res.status(404).render('error', { message: 'Case not found' });
    }
    const issues = caseTracker.getClosureIssues(caseDetails, action);
    const viewModel = baseViewModel({
      caseDetails,
      action,
      issues,
    });
    res.render('ct/closeCase', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.closeCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const action = req.params.action === 'cancel' ? 'cancel' : 'complete';
    const staff = getStaff(req);
    const updates = {
      ...req.body,
      status: action === 'complete' ? 'Completed' : 'Canceled',
    };

    if (action !== 'cancel') {
      updates.cancel_reason = null;
    }

    await caseTracker.updateCase(caseId, updates, staff);
    const updatedCase = await caseTracker.getCase(caseId);
    const issues = caseTracker.getClosureIssues(updatedCase, action);

    if (issues.length > 0) {
      const viewModel = baseViewModel({
        caseDetails: updatedCase,
        action,
        issues,
        error: 'Please resolve the items listed below before closing the case.',
      });
      return res.render('ct/closeCase', viewModel);
    }

    await caseTracker.finalizeCase(caseId, action, staff);
    res.redirect(`/ct/case/${caseId}`);
  } catch (error) {
    next(error);
  }
};

exports.customerProfile = async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const profile = await caseTracker.getCustomerProfile(customerId);
    if (!profile.cases.length) {
      return res.redirect('/ct?message=' + encodeURIComponent('No cases found for that customer ID.'));
    }
    const viewModel = baseViewModel({ profile });
    res.render('ct/customer', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.itemList = async (req, res, next) => {
  try {
    const items = await caseTracker.getItemSummary();
    const viewModel = baseViewModel({ items });
    res.render('ct/items', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.itemReport = async (req, res, next) => {
  try {
    const itemCode = req.params.item_code;
    const report = await caseTracker.getItemReport(itemCode);
    const viewModel = baseViewModel({ report });
    res.render('ct/item', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.viewAudit = async (req, res, next) => {
  try {
    const entries = await caseTracker.getRecentAudit();
    const viewModel = { entries };
    res.render('ct/audit', viewModel);
  } catch (error) {
    next(error);
  }
};
