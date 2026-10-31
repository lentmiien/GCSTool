# Japan Post country limits

Open **Shipping → Japan Post limits** (`/japan-post`). Enter the numeric `cid` from a Japan Post country URL and press **Fetch**. The server downloads only `https://www.post.japanpost.jp/cgi-kokusai/country.php?cid=…`; arbitrary URLs and redirects are not accepted.

The page shows the English country name, parcel air/surface limits, EMS limits, JSON, and previous versions. Measurements contain a numeric `value` and a `unit` (`m`, `cm`, `mm`, `kg`, or `g`). Unrecognized or conditional values remain text. Missing values appear as `null` in JSON and `—` on the page, with warnings. The name parser skips introductory suspension notices and reads the emphasized country name, preserving territorial lists.

Each service includes `unavailable: true` when its maximum weight is zero or its own limits contain `取り扱いなし` (including equivalent spellings). The cards and viewer display **Unavailable** instead of empty/zero limits, and suppress missing-limit warnings for that service. Raw size/weight evidence remains in JSON. `unavailable: false` only means these markers were absent; it does not confirm current acceptance or override suspension notices elsewhere on the page.

This status is also derived for existing cached versions on read, including same-day cache hits. No extra fetch, database migration, historical rewrite, or artificial change entry is needed merely to add the status field.

For example, CID 105 (Ireland), fetched on 2026-10-31, returns the following limits for each of parcel air, parcel surface, and EMS:

```json
{
  "size": {
    "length": { "value": 1.5, "unit": "m" },
    "lengthPlusGirth": { "value": 3, "unit": "m" }
  },
  "weight": { "value": 30, "unit": "kg" }
}
```

## Cache and database viewer

The two new Sequelize models are registered in `sequelize.js`; normal startup creates `japanPostCaches` and `japanPostSchedules` in the GCS database. No existing table needs alteration. Follow the repository backup procedure before starting a schema update.

Each cache version has `cid`, parsed `data`, `detectedAt`, and `lastCheckedAt`. `detectedAt` records when this app observed the values, not Japan Post’s publication date. Unchanged checks only update `lastCheckedAt`; changed parsed data creates a new immutable historical version. Invalid pages and failed downloads preserve existing cached data. If `lastCheckedAt` falls on today’s **Asia/Tokyo** calendar date, no external request is sent.

The database viewer (`/japan-post/database`) loads the latest version per CID and compares it with the immediately preceding version. Changed values are bold, with the old value in a tooltip. Filters cover country/CID, observed update date range, presence of history, and whether the entry was checked today. Clicking a CID opens its cached result and history without an external fetch.

## Scheduling

Enter up to 250 comma/whitespace-separated CIDs and a date. Each CID/date pair is unique. Jobs become due at **07:00 JST**, independent of the server’s local timezone. Today’s jobs scheduled after 07:00 start on the next available worker tick.

`bin/www` starts the worker after GCS database readiness. It checks once per second and handles one due job at a time, waiting at least 15 seconds after the previous scheduled job finishes. Cache rules apply to scheduled jobs too. Pending jobs persist across restarts; overdue jobs catch up, and interrupted jobs recover after a short grace period. The server must be running for on-time execution.

The queue displays pending, running, completed, failed, and cancelled states. Pending jobs can be cancelled. Rescheduling a failed/cancelled CID/date requeues it; a past date must instead be scheduled for today or later. Completed CID/date pairs are not requeued.

A MySQL connection-scoped advisory lock serializes fetches and schedule changes across app processes. Concurrent interactive requests receive a retryable busy response. A disconnected worker releases its lock automatically. The default Sequelize pool is sufficient (the worker uses one lock connection plus a database operation connection).

## API and verification

All endpoints require the existing app login. POST requests additionally need the session token from the page’s `data-csrf` attribute in `X-CSRF-Token`.

- `POST /japan-post/api/fetch` — `{ "cid": 105 }`; returns `latest.data`, timestamps, `history`, `fromCache`, and `changed`.
- `GET /japan-post/api/countries/:cid` — cache history, newest first; no fetch.
- `GET /japan-post/api/schedules` — latest 500 jobs.
- `POST /japan-post/api/schedules` — `{ "cids": "14,105", "date": "2026-11-02" }`.
- `POST /japan-post/api/schedules/:id/cancel` — cancel a pending job.

Run parser tests with `npm test -- --runTestsByPath tests/japanPost.test.js`. Database/HTTP/scheduler tests opt in with `JAPAN_POST_TEST_MYSQL_PORT`, pointing to a **disposable** MySQL server containing `gcs_japanpost_test`, with user `root` and an empty password. That suite recreates only its test tables and never loads `.env` or the application's database module:

```sh
JAPAN_POST_TEST_MYSQL_PORT=33309 npm test -- --runTestsByPath tests/japanPost.test.js tests/japanPostDatabase.test.js
```

Fixtures contain the relevant sections of the supplied Australia sample and the live Ireland download. For UI review, check Fetch and cached reuse, JSON, previous versions, changed-value highlighting, viewer filters, scheduling/cancellation, dark/light themes, and narrow screens.
