const { AppSetting } = require('../sequelize');
const { PackingError } = require('../services/smallestBox');
const { buildRequest, callApi, jobIdPattern } = require('../services/multiBox');

function sendError(res, error) {
  if (error.retryAfter && /^(\d+|[\w, :+-]+)$/.test(String(error.retryAfter))) res.set('Retry-After', String(error.retryAfter));
  res.status(error instanceof PackingError ? error.status : 503).json({
    message: error instanceof PackingError ? error.message : 'Packing settings are unavailable. Please try again later.',
  });
}

function sendJob(res, job, status = 200) {
  if (['queued', 'running'].includes(job.status)) res.set('Retry-After', '5');
  res.status(status).json(job);
}

exports.index = (req, res) => res.render('multibox', { pagetitle: 'Multi-box packer · GCS Support Tool' });
exports.containers = async (req, res) => {
  try { res.json(await callApi(AppSetting, '/containers')); }
  catch (error) { sendError(res, error); }
};
exports.submit = async (req, res) => {
  try {
    const payload = buildRequest(req.body);
    const job = await callApi(AppSetting, '/jobs', payload);
    // The API credential is shared by all staff; keep job access scoped to the
    // submitting login session, using the existing persistent session store.
    const jobs = (req.session.multiBoxJobs || []).filter((entry) => entry.expires > Date.now());
    jobs.push({ id: job.jobId, owner: String(req.user.id), expires: Date.now() + 8 * 86400000 });
    req.session.multiBoxJobs = jobs.slice(-100);
    req.session.save((error) => {
      if (error) return sendError(res, new PackingError('The job was submitted, but its local session could not be saved. Do not immediately resubmit.', 503, '60'));
      sendJob(res, job, 202);
    });
  } catch (error) { sendError(res, error); }
};
exports.job = async (req, res) => {
  try {
    const id = req.params.jobId;
    if (!jobIdPattern.test(id)) throw new PackingError('Invalid job ID.');
    const owned = (req.session.multiBoxJobs || []).some((entry) => entry.id === id && entry.owner === String(req.user.id) && entry.expires > Date.now());
    if (!owned) throw new PackingError('This job is unavailable in your current login session.', 404);
    const job = await callApi(AppSetting, `/jobs/${id}`);
    if (job.jobId !== id) throw new PackingError('The packing service returned the wrong job.', 502);
    sendJob(res, job);
  } catch (error) { sendError(res, error); }
};
