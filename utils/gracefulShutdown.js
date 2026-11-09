function createLifecycle() {
  let stopping = false;
  const pending = new Set();

  function begin() {
    let resolve;
    const done = new Promise(finish => { resolve = finish; });
    pending.add(done);
    return () => {
      pending.delete(done);
      resolve();
    };
  }

  return {
    isStopping: () => stopping,
    stop: () => { stopping = true; },
    drain: () => Promise.all([...pending]),
    async run(task) {
      if (stopping) return;
      const finish = begin();
      try { return await task(); } finally { finish(); }
    },
    middleware(req, res, next) {
      if (stopping) {
        res.set('Connection', 'close');
        res.set('Retry-After', '10');
        return res.status(503).send('The application is restarting. Please try again shortly.');
      }
      const finish = begin();
      const release = () => {
        res.removeListener('finish', release);
        res.removeListener('close', release);
        finish();
      };
      res.once('finish', release);
      res.once('close', release);
      next();
    },
  };
}

function installGracefulShutdown({ lifecycle, server, io, closeResources,
  runtime = process, logger = console, timeoutMs = 30000 }) {
  let shutdown;
  const stop = signal => {
    if (shutdown) return shutdown;
    lifecycle.stop();
    logger.log(JSON.stringify({ event: 'shutdown_started', signal, pid: runtime.pid }));
    // Keep this timer referenced: a stuck cleanup must not prevent PM2 recovery.
    const deadline = setTimeout(() => {
      logger.error('Graceful shutdown deadline exceeded; unfinished work may be interrupted.');
      runtime.exit(1);
    }, timeoutMs);
    shutdown = (async () => {
      try {
        server.close();
        // Disconnect persistent sockets; admitted socket handlers remain tracked.
        const socketsClosed = io.close();
        await Promise.all([lifecycle.drain(), socketsClosed]);
        await closeResources();
        clearTimeout(deadline);
        logger.log(JSON.stringify({ event: 'shutdown_complete', pid: runtime.pid }));
        runtime.exit(0);
      } catch (_) {
        clearTimeout(deadline);
        logger.error('Graceful shutdown cleanup failed.');
        runtime.exit(1);
      }
    })();
    return shutdown;
  };
  runtime.on('SIGINT', () => stop('SIGINT'));
  runtime.on('SIGTERM', () => stop('SIGTERM'));
  return stop;
}

module.exports = { createLifecycle, installGracefulShutdown };
