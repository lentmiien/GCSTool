const CaseTrackerService = require('../services/caseTracker');

const caseTracker = new CaseTrackerService();

function setLayoutLocals(req, res) {
  res.locals.role = req.user && req.user.role ? req.user.role : 'guest';
  res.locals.name = req.user && req.user.userid ? req.user.userid : 'Guest';
}

function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

function renderNotFound(req, res) {
  setLayoutLocals(req, res);
  res.status(404).render('error', {
    message: 'Case not found.',
    request: req.body,
  });
}

exports.dashboard = async (req, res, next) => {
  try {
    setLayoutLocals(req, res);
    const dashboard = await caseTracker.getDashboard();
    res.render('ct/ct', {
      ...dashboard,
      message: req.query.message || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.openCase = async (req, res, next) => {
  try {
    const result = await caseTracker.openCase(req.body.order_number);
    const message = result.created ? '?message=' + encodeURIComponent('New case created.') : '';
    res.redirect(`/ct/case/${encodeURIComponent(result.caseEntry.order_number)}${message}`);
  } catch (error) {
    if (error.message === 'Order number is required.') {
      return res.redirect('/ct?message=' + encodeURIComponent(error.message));
    }
    next(error);
  }
};

exports.caseDetail = async (req, res, next) => {
  try {
    setLayoutLocals(req, res);
    const viewModel = await caseTracker.getCaseView(req.params.orderNumber, null, {
      message: req.query.message || null,
    });

    if (!viewModel) {
      return renderNotFound(req, res);
    }

    res.render('ct/case', viewModel);
  } catch (error) {
    next(error);
  }
};

exports.updateCase = async (req, res, next) => {
  try {
    setLayoutLocals(req, res);
    const result = await caseTracker.updateCase(req.params.orderNumber, req.body);

    if (result.notFound) {
      return renderNotFound(req, res);
    }

    if (!result.ok) {
      return res.status(400).render('ct/case', result.viewModel);
    }

    res.redirect(`/ct/case/${encodeURIComponent(req.params.orderNumber)}?message=${encodeURIComponent('Case saved.')}`);
  } catch (error) {
    next(error);
  }
};

exports.admin = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.redirect('/ct?message=' + encodeURIComponent('Admin access required.'));
    }

    setLayoutLocals(req, res);
    const viewModel = await caseTracker.getAdminView();
    res.render('ct/admin', {
      ...viewModel,
      message: req.query.message || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.addComplaintType = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.redirect('/ct?message=' + encodeURIComponent('Admin access required.'));
    }

    const result = await caseTracker.addComplaintType(req.body.name);
    res.redirect('/ct/admin?message=' + encodeURIComponent(result.message));
  } catch (error) {
    next(error);
  }
};

exports.deleteComplaintType = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.redirect('/ct?message=' + encodeURIComponent('Admin access required.'));
    }

    const result = await caseTracker.deleteComplaintType(parseInt(req.params.id, 10));
    res.redirect('/ct/admin?message=' + encodeURIComponent(result.message));
  } catch (error) {
    next(error);
  }
};

exports.addSolutionType = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.redirect('/ct?message=' + encodeURIComponent('Admin access required.'));
    }

    const result = await caseTracker.addSolutionType(req.body.name);
    res.redirect('/ct/admin?message=' + encodeURIComponent(result.message));
  } catch (error) {
    next(error);
  }
};

exports.deleteSolutionType = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.redirect('/ct?message=' + encodeURIComponent('Admin access required.'));
    }

    const result = await caseTracker.deleteSolutionType(parseInt(req.params.id, 10));
    res.redirect('/ct/admin?message=' + encodeURIComponent(result.message));
  } catch (error) {
    next(error);
  }
};

exports.analytics = async (req, res, next) => {
  try {
    setLayoutLocals(req, res);
    const analytics = await caseTracker.getAnalyticsView();
    res.render('ct/analytics', analytics);
  } catch (error) {
    next(error);
  }
};
