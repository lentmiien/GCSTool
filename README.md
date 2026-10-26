# GCS Tool

GCS Tool is an internal web application for the Oh-ami Global Customer Support team. It brings support knowledge, staff scheduling, shipping/tracking tools, case tracking, policy/manual/template management, PDF utilities, and a few operational dashboards into one Express + MySQL application.

The app is server-rendered with Pug and Bootstrap-era static assets. Most features follow a route -> controller -> Sequelize model flow, with newer modules moving heavier business logic into `services/`.

## Tech Stack

- **Runtime:** Node.js `16.20.2` (`package.json` engines and Volta pin)
- **Server:** Express 4, Passport local auth, Express sessions, Socket.IO
- **Views:** Pug templates under `views/`
- **Client assets:** CSS and vanilla browser JavaScript under `public/`
- **Data:** MySQL through Sequelize 6
- **Utilities:** `express-fileupload`, `express-validator`, `csvtojson`, `pdf-lib`, `jimp`, `marked`, OpenAI SDK, and `zpl-renderer-js`

## Feature Areas

| Area | Mounted Path | Purpose |
| --- | --- | --- |
| Login/auth | `/login`, `/logout` | Passport local login with session-backed authentication. |
| Home/admin/about | `/`, `/admin`, `/admin/app-settings`, `/about`, `/timekeeper` | Recent content, user and app-settings administration, version history, and a lightweight in-memory timekeeper. |
| Knowledge entries | `/entry` | Team-scoped support content with master/personal entries, multi-part content, backup, and restore. |
| Scheduler | `/scheduler` | Staff defaults, holidays, day-by-day schedules, personal schedules, CSV exports, schedule analysis, and admin settings. |
| Workflows | `/workflows` | Linear shared tasks, manual and scheduled starts, variables, handover comments, history, and admin analytics. |
| Meeting board | `/meeting` | Meeting/comment board with Socket.IO updates. |
| Country/shipping status | `/country` | Official/internal/Japan Post country list imports, shipping status views, update history, and country-code linking. |
| API/PDF documents | `/api` | DHL return/tax PDF generation and invoice generation. |
| Bin packing | `/binpack` | Box packing helpers using `binpackingjs`. |
| Smallest box finder | `/smallest-box` | API-backed single-box search, tag filters, and a layered 3D packing preview. |
| HS tools | `/hs` | HS code suggestions, history lookup, Ireland TARIC mapping/explanations, shipping CSV compaction, manifest checking, and DB editing. |
| Tracker | `/tracker` | Tracking-data lookup and tracking-number upload tasks against the tracker database. |
| Shipping monitor compare | `/shipping-monitor-compare`, `/shipping-monitor-shortcuts` | Read-only saved comparisons over shipping monitor groups and shortcuts. |
| Shipping costs | `/shipcost` | Shipping cost import and view pages. |
| Feedback forms | `/form` | Feedback form formats and CSV export. |
| ChatGPT/language tools | `/chatgpt` | Chat history, generation helpers, and item-name shortening/language tools. |
| Case tracker | `/ct` | Open/support case workflow, complaint/solution lookup administration, validation, and analytics. |
| PMT | `/pmt` | Policy/Manual/Template document repository with Markdown, versions, dependency links, logs, and review flags. |
| Image grid PDF | `/image-pdf` | CSV upload -> product/image lookup -> generated image grid PDF. |
| DHL compensation | `/dhl-compensation` | DHL compensation entry tracking, uploaded PDF storage, estimated/completed dates, and PDF download. |
| Lennart tools | `/lennart` | ZPL conversion, host samples/trends, and AIT content update helper. |

## Project Structure

```text
app.js                 Express app setup, middleware, auth gates, and route mounting
bin/www                Runtime entry point; loads .env, starts HTTP + Socket.IO
passport_init.js       Passport local strategy and login router
socket_io_controller.js Authenticated Socket.IO meeting/comment events
sequelize.js           Sequelize connections, model registration, relations, sync, seed helpers
routes/                Thin Express routers for each feature area
controllers/           Request handlers; older features keep most business logic here
services/              Newer business logic modules (CT, PMT, tracking monitor, image PDF)
models/                Sequelize model factories, including ct/ and pmt/ submodules
views/                 Pug templates, usually named after routes/features
public/                CSS, browser JavaScript, sounds, and static assets
data/                  CSV/JSON/PDF/image reference data used by controllers and services
scripts/               Seed, host-monitor, cleanup, and maintenance scripts
utils/                 Reusable helpers such as OpenAI wrappers and temp cleanup
locales/               i18n JSON bundles for en/jp/sv
env_sample             Template for required and optional environment variables
```

## Database Layout

`sequelize.js` creates and exports multiple Sequelize connections:

- `DB_NAME_GCS`: primary application data, including users, app settings, entries/content, scheduler data, country lists, HS data, CT, PMT, forms, meetings, host samples, version history, and session storage.
- `DB_NAME_TRACK`: tracking data, tracker history tables, and shipping monitor group/entry/shortcut data.
- `DB_NAME_DHL_COMPENSATION`: optional DHL compensation database. If omitted, DHL compensation entries use `DB_NAME_GCS`.

Startup side effect: requiring `sequelize.js` registers models, runs `sequelize.sync()` for the configured databases, seeds default app settings and version history, and applies a small DHL compensation schema check for PDF columns.

### Workflows

Open **Workflows** in the navigation. `/workflows` lists only your assigned active tasks; the Today schedule links to this list when you have work waiting. `/workflows/definitions` is the shared library, `/workflows/history` is paginated run history, and `/workflows/analytics` is admin-only.

Admins create ordered tasks with instructions and any number of eligible staff. One staff member completes the active step to move forward; returning it moves back exactly one step and requires an error comment. The first step cannot be returned. Each task keeps exactly one editable comment, including across returns; action history stores who acted and when without retaining superseded comment text. Comment URLs are clickable. Only admins can cancel an open run, using its unique `/workflows/runs/:id` link.

Manual runs start when a member of the first unarchived task completes that task. Required variable values are entered at that point; every run also supports up to three custom variables editable by its participants. Required values can be corrected while the run is open. The My tasks page saves variable edits and the handover comment together when completing or returning a task. Each variable shows its last editor and edit time in Japan time; unchanged values keep their attribution. Older variables show that edit history is unavailable until they are changed. This metadata uses the existing JSON column, so no schema migration is needed. Automatic runs start with the first task active and use admin-defined required-variable defaults; `{date}`, `{month}`, and `{year}` expand from the scheduled Japan date.

Schedules support daily, selected weekdays, and monthly recurrence, with an interval of 1–60 days/weeks/months and a time in **Asia/Tokyo**. The first date anchors the interval. Weeks start Monday; a monthly date such as the 31st clamps to the last day of shorter months without shifting later runs. Every occurrence creates its own run, even while earlier runs remain open. A durable scheduler starts after GCS database readiness, polls every minute, and catches up at most 12 missed occurrences per definition per poll. Multiple app processes share database locks and a unique occurrence key. Pausing or downtime retains missed occurrences; resuming catches them up. Set a new first date to skip old periods. Changing other definition content preserves the schedule cursor.

Runs snapshot task instructions, ordering, workflow name, and variable definitions. Definition edits apply to future runs; assignment edits also update matching tasks in all open runs. Anyone may add/remove themselves unless membership is locked. Zero staff is allowed and reported in analytics, including outstanding run tasks and deleted user accounts. Archive existing tasks rather than removing them to preserve the ability to assign staff on older runs. Archiving a task excludes it from future runs; archiving a workflow prevents new runs. Both suppress their unassigned-task warnings and preserve history. Neither cancels ongoing runs.

Everyone can read definitions (including locked/archived definitions). Run details and history are limited to admins and staff who have been included in that run; leaving a task retains historical access. Staff can act only on an assigned active task, including admins. Transactions and revision checks reject stale submissions; manual start tokens prevent duplicate runs from double submissions. New forms use session CSRF tokens.

Startup creates six additive tables in `DB_NAME_GCS`: `workflowDefinitions`, `workflowRuns`, `workflowTasks`, `workflowAssignees`, `workflowParticipants`, and `workflowEvents`. No existing columns are changed and no default workflows are seeded. Back up the database before the normal application restart that creates these tables.

Focused checks: `npx jest tests/workflows.test.js tests/workflowBrowser.test.js --runInBand`. Database and route checks are opt-in and **erase only a disposable `gcs_workflow_test` database** on localhost: set `WORKFLOW_TEST_MYSQL_PORT` to a dedicated MySQL container's published port and run `npx jest tests/workflowDatabase.test.js --runInBand`. The tests never load the application's `.env`. They cover simultaneous completion, rejection, membership changes, cancellation, history isolation/pagination, scheduling catch-up, and zero-staff analytics.

### Shipping CSV compactor country filter

`/hs/compact` only edits destinations listed in `SHIPPING_COMPACTOR_COUNTRIES` under `/admin/app-settings`. The existing `app_settings.value` TEXT column stores a comma-separated list of two-letter CSV destination codes; no schema change is needed. Startup seeds a broad Europe list if the setting is missing, including transcontinental destinations and European territories with separate shipping codes. Existing settings are never overwritten. An empty list passes every entry through unchanged.

After saving the list, reload `/hs/compact` to use it. The **Download standalone tool (Japanese HTML)** link at `/hs/compact/download` embeds the current list into the offline HTML. Download and redistribute a new copy after changing countries; previously downloaded copies retain their list. `export_tools/shipping_csv_compactor_ja.html` is the source template, whose empty placeholder processes no countries when opened directly.

### Smallest box finder

`/smallest-box` runs alongside the original `/binpack` tool and is available to signed-in users through **Tools → Smallest box finder**. It uses the box catalog and packing API at `https://my.lentmiien.com`.

1. On the source site's `/binpacking-smallest` page, create a key under **API access**.
2. Restart GCS Tool to seed the empty `SMALLEST_BOX_API_KEY` setting, then save the key at `/admin/app-settings`. No schema change is needed. The key stays on the backend; the admin field does not redisplay it. A blank save preserves the key; **Remove key** clears it.
3. Paste the existing two-line item format (item ID, kg weight, width × depth × height in mm, then quantity), choose tag filters and an algorithm, set the safety margin (default **10 mm per side**), and select **Generate**. The margin reserves space against all six box walls, not between items; set it to 0 for no margin.

The catalog loads on opening and supports manual refresh. Searches use the source site's latest catalog. As defined by the API, **Require not** excludes matching boxes; **Require** alone does not exclude other boxes, and untagged boxes remain included. The preview uses the full box dimensions and returned rotated item dimensions and coordinates, which already include the safety margin offset. It groups layers by each item's bottom `z` coordinate. Down/Up, the slider, and layer headings select the highlighted layer; lower layers fade and higher layers can be shown as outlines.

Results offer up to three complete packing solutions, ordered by the API with the primary selected first. The solution selector updates the box, weights, placements, and preview without making another request. Each solution holds all items in one box; choose one solution for the shipment. Estimated cushion weight and shipment weight come directly from the API; shipment weight includes items, box, and cushion. Maximum load includes cushion, and actual shipping weight may vary. When the service stops checking alternatives early, the page keeps the completed solutions and displays a notice. Older responses without alternatives still show their primary solution; weights without cushion are explicitly labeled when estimates are unavailable.

Requests allow up to 100 item types and 200 total items (7 for brute force). Identical repeated IDs merge quantities; conflicting dimensions or weights are rejected. Searches run one at a time per GCS Tool process, use a 75-second upstream timeout, and never retry automatically. Configure any deployment reverse proxy to allow more than 75 seconds for `/smallest-box/pack`. Upstream rate limits are shared with other clients using the same key issuer.

Focused verification: `npm test -- --runTestsByPath tests/smallestBox.test.js tests/smallestBoxBrowser.test.js tests/shippingCompactorSettings.test.js`. These tests mock the upstream service; a live check requires a valid API key.

If loading boxes reports a missing catalog endpoint, update and restart the source site at `my.lentmiien.com`. It must provide both `GET /api/binpacking-smallest/containers` and `POST /api/binpacking-smallest`; older versions support only the search endpoint. A valid key can therefore run searches while catalog loading fails. GCS Tool reports an upstream missing endpoint as HTTP 502, since its own `/smallest-box/containers` route exists.

## Prerequisites

- Node.js `16.20.2`
- MySQL 8+ or a compatible MySQL server
- A MySQL user with DDL and DML privileges on the configured schemas
- A `.env` file based on `env_sample`

## Environment Variables

Required for a normal local run:

- `SESSION_SECRET`
- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_NAME_GCS`
- `DB_NAME_TRACK`

Common optional values:

- `DB_NAME_DHL_COMPENSATION`: separate DHL compensation schema; defaults to `DB_NAME_GCS` if blank.
- `COMPANY_DHL_ACCOUNT`, `COMPANY_COMPANY`, `COMPANY_CONTACT`, `COMPANY_PHONE`, `COMPANY_EMAIL`, `COMPANY_ADDRESS`: used by document/PDF generation.
- `OPENAI_API_KEY`, `OPENAI_API_KEY2`: used by ChatGPT/language helper flows.
- `LENTMIIEN_API_KEY`: used by Lentmiien API integrations, including the Ireland CSV AmiAmi lookup, CT item analytics cards, and image-grid PDF product details lookup. `PRODUCT_DETAILS_API_KEY` remains a fallback for the PDF lookup only.
- `HOSTNAME_OVERRIDE`, `PM2_BIN`, `HOST_SAMPLE_RETENTION_DAYS`: host sample collection and retention settings.
- `LINK_1` ... `LINK_5`: quick-access UI links.
- `AIT_UPDATES_CONTENT_ID`: content entry used by the Lennart AIT update helper.
- `SEED_ADMIN_USER`, `SEED_ADMIN_PASS`, `SEED_ADMIN_TEAM`, `SEED_ADMIN_NAME`: optional seed admin overrides.

## Getting Started

1. Install dependencies.

   ```powershell
   npm install
   ```

2. Create a local environment file.

   ```powershell
   copy env_sample .env
   ```

   Fill in the required DB/session values and any optional integrations needed for the flows you use.

3. Create the MySQL schemas.

   Create at least the schemas named by `DB_NAME_GCS` and `DB_NAME_TRACK`. Create `DB_NAME_DHL_COMPENSATION` too if you want DHL compensation data in a separate schema.

4. Seed the first admin user.

   ```powershell
   npm run seed
   ```

   The seed script syncs the GCS/tracker schemas and creates the initial admin user, matching username display row, and scheduler staff row if they do not already exist.

5. Start the app.

   ```powershell
   npm start
   ```

   `bin/www` loads `.env`, starts temp cleanup, attaches Socket.IO to the HTTP server, and listens on `PORT` or `3000`.

## Scripts

```text
npm start                    Start the Express + Socket.IO server
npm run seed                 Sync DBs and create the initial admin/user/staff records
npm run collect:host-sample  Insert one host sample row
npm run cleanup:host-samples Delete host samples older than HOST_SAMPLE_RETENTION_DAYS
npm run repair:ireland-barcode Repair Ireland barcode/TARIC mappings
npm run generate:shipping-compactor-samples Generate local 5,000-order CSV stress samples
npm run codex-todo           Ask Codex to work through todo.txt
npm run codex-commit         Ask Codex to draft a commit message for pending changes
```

## Development Notes

- Follow the existing JavaScript style: CommonJS modules, 2-space indent, single quotes, semicolons.
- Keep route files thin when possible. Newer code generally belongs in a service under `services/`, with controllers handling request/response mapping.
- Use existing Sequelize exports from `sequelize.js`; model factories under `models/` are wired there.
- `views/layout.pug` is the shared shell for nav, user status, common scripts, Socket.IO client setup, and content blocks.
- Run `npm test` for the focused Jest integration/security/DOM suite. The optional outbox database tests require an isolated MySQL database; see the [TARIC integration runbook](documentation/ireland-taric-predictor.md). Before shipping changes, also smoke-test auth, Entries, Scheduler, CT, PMT, uploads, locale switching, and startup sync behavior.
- When dependencies or scripts change, keep `package-lock.json` in sync.

## Host Monitor Cron Jobs

The host monitor is implemented as standalone scripts:

- `npm run collect:host-sample` inserts one row into `host_samples`.
- `npm run cleanup:host-samples` removes rows older than `HOST_SAMPLE_RETENTION_DAYS` days. The default is `30`.

On EC2 or similar hosts, cron usually has a minimal `PATH`. Use absolute paths for both Node and project files. If PM2 was installed through `nvm`, set `PM2_BIN` in `.env` to the full binary path, for example:

```text
/home/ec2-user/.nvm/versions/node/v16.20.2/bin/pm2
```

Example cron entries:

```cron
* * * * * /home/ec2-user/.nvm/versions/node/v16.20.2/bin/node /home/ec2-user/GCSTool/scripts/collect_host_sample.js >> /home/ec2-user/GCSTool/temp/collect_host_sample.log 2>&1
15 0 * * * /home/ec2-user/.nvm/versions/node/v16.20.2/bin/node /home/ec2-user/GCSTool/scripts/cleanup_host_samples.js >> /home/ec2-user/GCSTool/temp/cleanup_host_samples.log 2>&1
```

Test both commands manually on the host before enabling cron.

## Troubleshooting

- **Cannot connect to DB:** Verify `.env`, schema existence, network access, and MySQL privileges. The app needs permission to create expected tables because `sequelize.sync()` runs on startup; the DHL compensation schema helper can also add expected PDF columns.
- **Cannot log in:** Ensure `SESSION_SECRET` is set, the `sessions` table exists, and at least one user exists. Run `npm run seed` for a first admin.
- **Missing generated PDFs or uploads:** Check required company/API environment variables and the writable `temp/` directory.
- **OpenAI helpers fail:** Confirm the relevant `OPENAI_API_KEY` or `OPENAI_API_KEY2` value is set.
- **Locale strings missing:** Update the JSON bundles under `locales/` and confirm the keys match Pug/controller usage.
- **Static files appear stale:** Clear browser cache and verify the expected file under `public/` is being served.

## Security Notes

- Never commit `.env` or real credentials.
- Use a non-root MySQL user with only the privileges this app needs.
- Back up databases before schema-affecting changes. Startup sync can create or alter expected tables.
- Avoid logging credentials, uploaded file contents, personal data, or API responses that may contain sensitive support information.

## Ireland TARIC predictor

The existing `/hs/ireland` manual assignment modal includes an advisory, server-forced test predictor and durable manual-feedback outbox. Page load and automatic JAN matches never request predictions. See [deployment, limits, tests and manual checks](documentation/ireland-taric-predictor.md).
