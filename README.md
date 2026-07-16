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
| Meeting board | `/meeting` | Meeting/comment board with Socket.IO updates. |
| Country/shipping status | `/country` | Official/internal/Japan Post country list imports, shipping status views, update history, and country-code linking. |
| API/PDF documents | `/api` | DHL return/tax PDF generation and invoice generation. |
| Bin packing | `/binpack` | Box packing helpers using `binpackingjs`. |
| HS tools | `/hs` | HS code suggestions, history lookup, Ireland TARIC mapping/explanations, manifest checking, and DB editing. |
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
- `LENTMIIEN_API_KEY`: used by Lentmiien API integrations, including the Ireland CSV AmiAmi lookup and image-grid PDF product details lookup. `PRODUCT_DETAILS_API_KEY` remains a fallback for the PDF lookup only.
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
npm run codex-todo           Ask Codex to work through todo.txt
npm run codex-commit         Ask Codex to draft a commit message for pending changes
```

## Development Notes

- Follow the existing JavaScript style: CommonJS modules, 2-space indent, single quotes, semicolons.
- Keep route files thin when possible. Newer code generally belongs in a service under `services/`, with controllers handling request/response mapping.
- Use existing Sequelize exports from `sequelize.js`; model factories under `models/` are wired there.
- `views/layout.pug` is the shared shell for nav, user status, common scripts, Socket.IO client setup, and content blocks.
- There is no automated test suite configured. Before shipping changes, smoke-test affected routes plus auth, Entries, Scheduler, CT, PMT, uploads, locale switching, and any DB migrations/sync behavior you touched.
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
