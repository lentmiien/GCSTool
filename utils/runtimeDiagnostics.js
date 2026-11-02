const { monitorEventLoopDelay } = require('perf_hooks');
const v8 = require('v8');

// Small, fixed-size records: never retain samples or include request/user data.
// This is diagnostic only; an event-loop timer cannot protect a frozen host.
function startRuntimeDiagnostics({ intervalMs = 30000, output = process.stdout } = {}) {
  const delay = monitorEventLoopDelay({ resolution: 100 });
  delay.enable();

  function sample() {
    const memory = process.memoryUsage();
    const record = {
      event: 'runtime_sample',
      ts: new Date().toISOString(),
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      heapLimitBytes: v8.getHeapStatistics().heap_size_limit,
      externalBytes: memory.external,
      arrayBufferBytes: memory.arrayBuffers,
      eventLoopMaxMs: Math.round(delay.max / 1e6),
    };
    delay.reset();

    // Do not accumulate diagnostic output in RAM if the log consumer stalls.
    if (!output.destroyed && !output.writableNeedDrain) {
      output.write(`${JSON.stringify(record)}\n`);
    }
  }

  sample();
  const timer = setInterval(sample, intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    delay.disable();
  };
}

module.exports = { startRuntimeDiagnostics };
