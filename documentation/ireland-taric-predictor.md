# Ireland manual TARIC predictor

`/hs/ireland` keeps the existing CSV parsing, automatic mapping, mapping saves,
work summary and export. Opening the page makes **zero predictor/feedback calls**.
Only an item shown in the existing manual review modal starts a test request.
Exact JAN automatches never enter that modal. Existing name/HS suggestions remain.

The predictor uses the source description, JAN as a string (including leading
zeros), and ORIGINAL six-digit HS. Dots/whitespace in HS are removed; eight- or
ten-digit source codes are rejected, never truncated or replaced by the selected
TARIC. GCS has no item_code. Missing JAN skips both prediction and linked feedback.
Invalid input gives local help without preventing manual selection.

All output is advisory and unverified. Suggestions require **Use suggestion** or
manual typing and then **Next/Finish**. Arriving output never changes the selected
code. Rejected diagnostic proposals are escaped plain text labelled
**UNVALIDATED / REJECTED**, never selectable recommendations. Only bounded code,
description, adapter and allowlisted evidence resolution are projected; no raw
provider envelopes, hidden reasoning, tools, source facts or secrets reach the UI.
`EVIDENCE_NOT_FOUND` is expected when a JAN is absent from AmiAmi's database. It
still has a terminal request ID and can receive a manual final choice.

## Configuration and human deployment

The existing private environment already supplies `TARIC_TOOL_KEY` and
`TARIC_TOOL_BASE_URL`. No browser configuration is needed. `env_sample` contains
placeholders only. The base accepts an HTTPS app origin or its `/api/taric/v1`
prefix (optional trailing slash); explicitly configured private IPv4 HTTP is also
supported. Credentials, queries, fragments and other paths are refused. The
validated worker configuration is fixed until application restart. Never put
keys in browser code, outbox rows, logs, commands or commits.

At a separately authorized deployment, install with `npm ci` using the repository
Node 16.20.2 runtime. Jest 29, jsdom and Supertest are development-only additions;
there are no new production dependencies. Production-only installs may use
`npm ci --omit=dev`. Back up the GCS database under the normal deployment process.
Existing `sequelize.sync()` adds the new `irelandtaricjobs` table; it does not use
`force` or `alter` for this change. No separate migration/bootstrap is required.
The outbox worker starts in `bin/www` after `gcsDatabaseReady` resolves. Starting
only `app.js` does not start delivery. The worker requires the application's
normal MySQL permissions to create/read/update/delete its new table. No production
startup, migration, deployment or restart was performed during implementation.

Routes inherit `/hs` authentication, including its temporary-password restriction.
Predictor routes additionally enforce authenticated ownership on every read and
write. All POSTs require a session-bound HMAC CSRF token, JSON and a 4 KiB bound.
Responses are private/no-store. The browser cannot choose an upstream destination,
model, system prompt, item_code or test mode. Server submission always sends
literal `test:true`. Fixed ID-derived paths, no redirects, a 15-second absolute
request deadline and a 128 KiB response bound prevent arbitrary upstream relays.
Errors/logs contain safe codes or fixed messages, not HTTP/ORM error objects.

## Durable feedback and limits

The server-side MySQL row stores owner, random attempt ID, processing run ID,
row/column item identity, revision, a SHA-256 digest of canonical input, upstream
ID, final choice, sanitized output, delivery status, deadlines and retry counters.
No credential is stored. Labels/JANs are private business data: use the normal
restricted database access and backup policy.

Next/Finish first updates the original local CSV item and sends one keepalive POST
to GCS to register/replay the attempt and persist its final choice. It waits at most
two seconds for **local** durability, never for upstream prediction/feedback. The
button ignores duplicate clicks during that handoff. If GCS is unreachable, the
CSV flow still advances, bounded background retries continue, and the status
explicitly says the choice is not durably queued. Keep that page open and use
**Check queued AI feedback** to retry. Browser close/navigation is recoverable
once GCS acknowledges the queued selection; durability cannot be promised before
that acknowledgement. No browser-local persistent copy of private CSV data is
created. Closing the modal cancels local waiting, not an already queued remote job.

The worker waits for the correlated prediction to become terminal before sending
exactly `{selected_code: '10 ASCII digits'}`. This includes failed predictions.
Upstream alone derives `accepted`, `changed` or `manual`, with `unverified` and
`training_approved:false`. Empty/invalid/cancelled choices send no feedback. If
admission was rejected without an upstream ID, feedback is `unavailable` and the
UI explains why; GCS never invents an upstream ID.

Prediction and feedback use different stable idempotency keys derived from the
local attempt ID and action. Unknown acceptance retries the same input/key. Each
upstream request accepts only one final choice. Reopening a pending item reuses
its request; changing a previously finalized selection creates a new revision and
request, retaining the old immutable association. A 409 idempotency conflict is
shown as failed delivery, never silently rewritten. Explicit retries retain the
same key and cannot fix a conflicting upstream final choice. The CSV choice is
still saved. **Retry / check request** creates a fresh prediction only after a
known terminal/rejected attempt without a final choice; uncertain attempts resume
with the original ID.

The UI waits two minutes, without overlapping local polls; leaving the item/new
CSV invalidates its callbacks. Server delivery survives navigation and restart.
The worker has a cross-process 60-second database lease, one HTTP call at a time,
at most two unresolved remote admissions, at most 200 queued/pending/paused rows,
20 active rows per owner and 500 new rows per owner/day. Unknown admissions reserve
a slot to avoid retry storms. The worker polls at five seconds initially, then
30 seconds, capped at 240 polls. Retries use exponential backoff, up to eight
failures; Retry-After is respected up to the job's expiry, after which no request
is sent. Jobs expire after one day; a final choice extends delivery to seven days.
There are at most three explicit resumes within seven days of creation. Paused
uncertain jobs keep their admission slot; inspect/resume them instead of deleting
an association and submitting duplicate work. Once an unknown job is confirmed
terminal, its slot is released. The browser's owner-scoped queue panel shows
pending/sent/failed/unavailable and offers manual retry. Requests without final
choices remain visible for diagnosis but produce no feedback.

An hourly worker cleanup removes terminal/rejected/paused records after 30 days
without updates, including failed delivery history. It never removes active work.
Expired pending work first pauses. Do not delete unresolved rows simply to free a
slot: their upstream outcome may be unknown. Upstream contract records/idempotency
expire after 90 days. GCS is a small delivery outbox, not a training approval system.

## Contract and safe connection check

Verified against the Site checkout's `documentation/taric-runbook.md`,
`public/yaml/taric-assisted.v1.yaml` (OpenAPI 3.1.0, contract 1.0.3),
`routes/taric.js`, and `services/taric/service.js`. Shipped paths are:

- `POST /api/taric/v1/requests`
- `GET /api/taric/v1/requests/{32 lowercase hex digits}`
- `POST /api/taric/v1/requests/{id}/feedback`

Terminal fields are `state`, `test`, `result.taric_code`, `result.description`,
`result.description_source`, `result.verification`, `result.training_approved`,
`error`, `evidence.provenance.resolution` and `diagnostics.proposal`. HTTP 202 is
pending; HTTP 200 can be failed/interrupted as well as complete. Poll URLs in the
response are never followed. An upstream 404 before admission has no feedback ID.

Run `node scripts/check_ireland_taric_connection.js` only for a read-only connection
check. It privately loads the configured environment and reads a random valid
opaque ID. Source confirms authentication and read authorization precede the scoped
lookup. The expected response is HTTP **404 NOT_FOUND**; HTTP 401/403 are not success.
The check prints only HTTP status, expected-not-found boolean and mutation count.
It creates no prediction, evidence lookup, feedback, fabricated label or GPU job.
The implementation-session check returned 404/NOT_FOUND, mutations 0. This proves
credentials and request-read access, not inference readiness or feedback-write scope.

## Automated and manual verification

`npm test` runs protocol, real loopback HTTP transport, worker, authenticated route,
page-render and jsdom tests. Without `TARIC_TEST_MYSQL_PORT`, transactional MySQL
tests are explicitly skipped. For all tests, use a **new disposable** MySQL instance:

```sh
docker run --detach --rm --name gcs-taric-tests --tmpfs /var/lib/mysql:rw \
  --publish 127.0.0.1::3306 --env MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  --env MYSQL_DATABASE=gcs_taric_test mysql:8.4
docker port gcs-taric-tests 3306
# Wait until mysqladmin ping succeeds, then substitute that published port:
TARIC_TEST_MYSQL_PORT=PORT npm test
docker stop gcs-taric-tests
```

These tests never load `.env` or application startup. Database tests use only
`127.0.0.1`, database `gcs_taric_test`, and synthetic fixtures, and recreate their
test tables. Never point the variable at a shared/development/production database.
There are no repository build or lint scripts; use `node --check` on changed JS
and `git diff --check`. Template compilation is exercised by the page and DOM tests.

Human verification after authorized deployment:

1. Sign in at `/hs/ireland`. In the network panel confirm no `/predictor/` requests
   on page load. Select a synthetic CSV where every JAN maps automatically and
   confirm zero predictions, normal saved mappings/summary and CSV export.
2. Select a CSV with a manual-review item containing a valid JAN and original
   six-digit HS. Only that current item should submit. Check preserved leading
   zeros, original HS and descriptive label, loading state and manual confirmation
   language. No key should appear in browser requests/responses.
3. Enter your own TARIC while waiting. A later suggestion must leave it unchanged.
   **Use suggestion** explicitly copies the suggestion; it must not save/advance.
   A CATALOG_REJECTED preview stays visibly rejected, escaped and non-selectable.
4. Repeat with missing JAN, invalid JAN, and eight-/ten-digit source HS. Confirm
   local help, zero predictor/feedback calls and an uninterrupted manual workflow.
5. Exercise EVIDENCE_NOT_FOUND and an API outage with a local fake API first. Confirm
   useful error text and manual progression. Select a valid final code and click
   Next/Finish while prediction is pending; the CSV saves independently, feedback
   stays pending then sends against the same terminal ID, even on prediction failure.
6. Double-click Next; reopen a pending item; close/reopen the modal; select a new
   CSV before the old response arrives. Confirm no other item/choice changes.
   Revisit a finalized item with a different choice and verify a new revision.
7. After the durable-queue acknowledgement, navigate away/restart a disposable
   backend and check delivery recovery. Simulate 429, timeout and conflict in the
   fake API; verify stable-key retries and visible failed status/manual retry.
   No upstream ID must show unavailable, never a fabricated correlation.
8. Review modal/queue readability, scroll and controls in dark mode first, then
   toggle light mode. Smoke-test auth, Entries, Scheduler, CT, PMT, uploads and
   locale switching with the normal test environment.

The implementation session exercised synthetic automated flows and real isolated
MySQL plus loopback HTTP, not live inference/feedback. The in-app browser runtime
reported no browser available, so visual review and human end-to-end CSV checks
remain outstanding. No production services were started or restarted.

Validation also passed on the pinned Node 16.20.2 runtime. Production dependency
audit reported 32 existing issues (14 high, 13 moderate, 5 low, no critical),
including existing Axios/Express/MySQL/Sequelize versions. This scoped integration
does not perform a repository-wide dependency upgrade. The predictor accepts no
caller-provided HTTP config, disables proxy/redirect handling, never streams
uploads/responses through Axios, and has explicit body/deadline tests; those
constraints are not a claim that the application's broader dependency audit is clean.
