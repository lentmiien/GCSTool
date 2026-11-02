# Runtime safety on a small EC2 host

## What we know

The reported host has about 979 MB RAM, no swap, and two PM2 processes:

| Process | Average RSS | Known peak RSS |
| --- | ---: | ---: |
| gcstool | 313.4 MB | 480 MB |
| tracker | 71.7 MB | 83 MB |

At 75.8% host memory usage, about 237 MB remains available. Subtracting the two
average process sizes suggests roughly 357 MB of other host usage. If both
processes hit their known peaks with similar overhead, only about 59 MB remains.
These are rough estimates: measurements might not be simultaneous and RSS can
double-count shared pages. They support memory pressure as a hypothesis, not a
confirmed diagnosis. The existing Linux sampler uses `MemAvailable`, rather than
counting all filesystem cache as unavailable memory.

Moving to at least 2 GiB RAM is the recommended capacity starting point; validate
with real workload measurements. A small swap area can provide a buffer for
short spikes, but is slower than RAM and does not solve a leak or sustained load.
The current host cannot comfortably accommodate known peaks plus OS headroom.

## Changes included in this repository

- `bin/www` loads `.env` from the project directory independently of PM2's
  working directory and stops before app initialization if `SESSION_SECRET` is
  missing or blank. Restore the existing secret after recovery and restart the
  app; an empty inherited process variable must also be corrected because it
  takes precedence over the file value.
- `bin/www` writes one small JSON `runtime_sample` at startup and every 30 seconds
  to stdout (normally the PM2 output log). Records include RSS, JS heap usage and
  limit, external memory, ArrayBuffer memory, maximum event-loop delay, uptime,
  and PID. No request content or credentials are included. Samples are not kept
  in memory; output is skipped while the logging stream reports backpressure.
- Host sampling exits after 45 seconds; retention cleanup exits after 5 minutes.
  Collector child commands have a 5-second timeout and bounded output, and each
  job uses at most one database pool connection. These deadlines also cover a
  stuck DB query or connection close while the event loop remains responsive.
- `ecosystem.config.js` provides an explicit RSS restart threshold, V8 old-space
  limit, one fork, and restart delay. It requires deployment-specific budgets.
  Nothing changes on AWS until the code/configuration is deployed.

RSS is the resident size of the whole process. The V8 old-space limit is only a
part of that: uploaded Buffers, images, native allocations, and other heap spaces
also need memory. `arrayBufferBytes` is included in `externalBytes`; do not add
them together. A rising heap suggests a different investigation from a stable
heap with rising external memory or RSS. Event-loop delay can help identify CPU
blocking, but cannot record a stall until execution resumes.

## Deploy PM2 protection

1. Read `pm2 describe gcstool` and `pm2 describe tracker` on the host. Check that
   each is a single Node process and identify the owning user/startup service.
   Do not paste `pm2 jlist` output into tickets: it can contain environment secrets.
2. Observe `runtime_sample` records under normal use and representative imports,
   image/PDF work, and reports. Choose a heap budget above normal heap use, and a
   higher RSS threshold with room for external/native memory. Budget **both apps**,
   the PM2 daemon, monitoring jobs, the proxy and OS. On the 979 MB host, allowing
   the existing 480 MB gcstool peak already leaves little safety margin; a lower
   limit deliberately trades failed requests/restarts for host availability.
3. Set `PM2_APP_NAME=gcstool`, `PM2_MAX_MEMORY_MB`, and `PM2_HEAP_MB` in `.env`.
   Values are integer MiB; heap must be lower than RSS. There is intentionally no
   guessed default. If `gcstool` already runs `bin/www` directly, apply:

   ```sh
   pm2 startOrRestart ecosystem.config.js --only gcstool --update-env
   pm2 describe gcstool
   pm2 save
   ```

   If the existing entry runs `npm start` or another wrapper, replace that entry
   during a maintenance window so PM2 supervises Node directly. Avoid starting a
   second copy alongside the existing process. The configuration does not manage
   `tracker`; set its own limit in its deployment configuration too.
4. Verify startup and normal workflows after the restart. Monitor restart counts
   and errors. In fork mode restarts interrupt requests and sockets; in-flight
   imports or background work may be interrupted. Ten starts lasting under
   60 seconds can leave the app errored; alert on that state. Investigate tight
   limits instead of repeatedly restarting. Keep PM2 logs under rotation with a
   bounded retention policy and forward them off-host.

[PM2 checks memory approximately every 30 seconds](https://pm2.keymetrics.io/docs/usage/restart-strategies/).
Its threshold is not a hard memory cap and can miss a rapid allocation spike.
Do not use cluster reloads to work around downtime on this small host: overlapping
processes consume more memory and duplicate in-process schedulers.

## Add an OS-enforced boundary

Use a systemd/cgroup memory budget so application allocations cannot consume the
whole host. [systemd recommends `MemoryHigh` for normal control and `MemoryMax`
as the last line of defense](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).
Verify the host OS, systemd version and cgroup support before deployment.

With a typical PM2 startup service, **both apps and the PM2 daemon share its
cgroup**. A limit on `pm2-ec2-user.service` therefore applies to their combined
usage, not just gcstool. Account for that, or isolate apps into separate services.
Verify the actual processes are in the intended cgroup; limiting a shell that
calls an already-running PM2 daemon does not constrain its existing children.

As an illustration to evaluate on the current host, a combined PM2 service
`MemoryHigh=550M`, `MemoryMax=600M` leaves about 379 MB outside that service.
This is **not a verified production setting**: the exact PM2 overhead, monitoring
jobs and other services must be measured. The kernel may kill a process, including
the supervisor, at the cap. Verify service recovery and app resurrection under
that condition in a test environment. Apply service changes in a maintenance
window. There is no budget that guarantees both unrestricted heavy operations
and a responsive 979 MB host.

## Prevent overlapping cron jobs

Create `temp/` first. Use the same OS user/environment as the PM2 daemon so the
sampler queries the correct PM2 instance. Ensure Node and PM2 are on cron's PATH
or set `PM2_BIN` to the installed executable. Replace paths for your deployment.
On Linux, `flock` prevents overlap and external `timeout` also handles a stuck
Node event loop:

```cron
* * * * * /usr/bin/flock -n /home/ec2-user/GCSTool/temp/host-sample.lock /usr/bin/timeout -k 5s 50s /home/ec2-user/.nvm/versions/node/v16.20.2/bin/node /home/ec2-user/GCSTool/scripts/collect_host_sample.js >> /home/ec2-user/GCSTool/temp/collect_host_sample.log 2>&1
15 0 * * * /usr/bin/flock -n /home/ec2-user/GCSTool/temp/host-cleanup.lock /usr/bin/timeout -k 5s 310s /home/ec2-user/.nvm/versions/node/v16.20.2/bin/node /home/ec2-user/GCSTool/scripts/cleanup_host_samples.js >> /home/ec2-user/GCSTool/temp/cleanup_host_samples.log 2>&1
```

Verify utility paths and commands manually, replace existing cron entries rather
than adding duplicates, and rotate these logs too. The runtime diagnostic timer
does not require an additional cron job or DB table.

## Evidence that survives an incident

- Enable persistent system journaling with disk limits and off-host forwarding
  of kernel and PM2 logs. After a reboot, inspect the previous boot if retained:

  ```sh
  sudo journalctl -k -b -1 --no-pager | rg -i 'out of memory|oom|killed process|memory cgroup|blocked for|I/O error'
  ```

  Also check current-boot kernel logs if the host recovered without rebooting.
  A missing OOM message does not rule out pressure or an unflushed final log.
- Use CloudWatch agent metrics for
  [`mem_available_percent`, available memory, swap and disk](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/metrics-collected-by-CloudWatch-agent.html)
  plus [per-process RSS](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-procstat-process-metrics.html).
  Monitor CPU, burstable-instance CPU credits where applicable, and EC2 status
  checks as alternative explanations. Set sustained low-memory alerts and an
  alert for missing samples; use an external HTTP uptime check as well. A host
  agent can also freeze, so already-shipped data and missing-heartbeat alerts
  matter more than expecting one final sample.
- Avoid automatic heap snapshots on this host: [capturing one can require
  substantial additional memory](https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot).
  Reproduce and profile on a larger staging host.

## Application hotspots still needing workload-specific limits

- Authenticated uploads use in-memory buffering: ten files of up to 20 MiB per
  request allow 200 MiB of file data, plus buffer concatenation and parsing copies.
  Concurrent requests multiply this. Moving to disk requires adapting callers
  that read `file.data`, private temporary storage and cleanup; merely enabling
  `useTempFiles` would break current imports. Aggregate upload and concurrency
  limits should be chosen from actual import requirements.
- Image-grid PDF generation buffers downloaded images, decodes them with Jimp,
  and builds the PDF in memory. Downloads and CSV rows lack workload-specific
  limits. Compressed file size alone does not bound decoded image memory.
  Consider strict dimensions/row limits and an isolated worker with a memory cap.
- Several controllers load whole tables with `findAll()`, including chat history
  and scheduler data. Pagination, date ranges and selecting only required columns
  can reduce allocations as tables grow; measure the expensive requests first.

These are concrete risks found in code, not identified causes of the three
historical freezes. Existing sessions are DB-backed and the inspected schedulers
already prevent overlapping ticks within a process.
