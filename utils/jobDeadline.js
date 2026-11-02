// Cron jobs must not stay alive indefinitely on a failed DB or subprocess.
// Also use flock/timeout in cron: this timer needs a responsive event loop.
function startJobDeadline(job, timeoutMs) {
  const timer = setTimeout(() => {
    process.stderr.write(`${JSON.stringify({
      event: 'job_deadline_exceeded',
      ts: new Date().toISOString(),
      job,
      timeoutMs,
    })}\n`);
    process.exit(1);
  }, timeoutMs);
  timer.unref();
  return () => clearTimeout(timer);
}

module.exports = { startJobDeadline };
