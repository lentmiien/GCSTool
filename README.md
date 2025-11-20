# GCS Tool

GCS Tool is the internal platform used by the Oh-ami Global Customer Support team to centralize knowledge, plan staffing, and streamline day-to-day operations. The app combines a knowledge base, scheduling board, CT/PMT workflows, and lightweight file utilities inside a single Express + MySQL stack.

## Feature Highlights
- **Knowledge Hub:** Templates, manuals, and company contact snippets that agents can search, localize, and copy quickly.
- **Scheduler:** Staff, holiday, and shift data synchronized through Sequelize models, rendered as an at-a-glance staffing board.
- **CT / PMT modules:** Task-specific screens that guide case handling, including form validation and OpenAI-assisted helpers.
- **File & entry management:** CSV/XML importers, PDF generation, and file uploads for distributing collateral.
- **Localization & personalization:** Locale switching and browser-saved personal settings (`json_personal`) to tailor the UI per agent.
- **Real-time collaboration:** Socket.IO sessions keep dashboards fresh and relay notifications between connected agents.

## Tech Stack
- **Runtime:** Node.js 16.20.2
- **Server:** Express 4 with Socket.IO and Passport for session-based auth
- **Views:** Pug templates served with SCSS/vanilla JS assets under `public/`
- **Data:** MySQL + Sequelize (`sequelize.js` wires models and relations)
- **Utilities:** Express-validator, express-fileupload, csvtojson, pdf-lib, OpenAI SDK, and localized content under `locales/`

## Prerequisites
- Node.js 16.20.2 (match the `.nvmrc` / `package.json` `engines`)
- MySQL 8+ (or compatible) with two schemas: `DB_NAME_GCS` and `DB_NAME_TRACK`
- A `.env` file based on `env_sample`

## Getting Started
1. **Clone and install**
   ```powershell
   git clone <repo-url>
   cd GCSTool
   npm install
   ```
2. **Configure environment**
   ```powershell
   copy env_sample .env   # PowerShell: Copy-Item env_sample .env
   ```
   Fill in:
   - `SESSION_SECRET`: random string used by Express sessions
   - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME_GCS`, `DB_NAME_TRACK`
   - Company profile fields (`COMPANY_*`) for headers and document templates
   - Optional OpenAI keys (`OPENAI_API_KEY`, `OPENAI_API_KEY2`) for AI helpers
   - `LINK_1` ... `LINK_5` to wire quick-access resources in the UI
3. **Prepare databases**
   - Create both schemas manually (`CREATE DATABASE ...`)
   - Ensure the configured MySQL user has DDL + DML permissions
   - `sequelize.sync()` runs on startup and will create missing tables
4. **Run the app**
   ```powershell
   npm start
   ```
   The server boots via `bin/www`, loads `.env`, and listens on `PORT` (defaults to `3000`). Socket.IO rides on the same HTTP server.

## Project Structure
```
app.js                # Core Express app (middleware, routes, i18n)
bin/www               # Entry point that starts HTTP + Socket.IO
controllers/          # Request handlers (e.g., ctController.js)
routes/               # Express routers mounted in app.js
models/               # Sequelize models for users, entries, schedule, etc.
views/                # Pug templates rendered by controllers
public/               # Static assets (stylesheets, javascripts, js/)
services/             # Higher-level helpers (e.g., file + AI utilities)
utils/                # Reusable helpers such as ChatGPT wrappers
locales/              # i18n resource bundles
sequelize.js          # Model registration and relation setup
env_sample            # Template for required configuration
```

## Data Domains
- `user`: Authenticated agents; access to all other data is gated by this table.
- `entry` / `content`: Separate structures for structured metadata and rich text bodies.
- `staff`, `schedule`, `holiday`: Power the scheduler, associating shifts with people and blackout dates.
- `json_personal` (browser local storage): Stores per-user UI preferences and filters.
- Additional domain modules (CT, PMT, uploads, localization) read/write auxiliary tables in `DB_NAME_TRACK`.

## Development Notes
- Follow the existing 2-space, single-quote, CommonJS style; mirror nearby patterns in controllers/routes.
- There is no automated test suite yet; smoke test authentication, Entries, Scheduler, CT, PMT, file upload, and locale switching before shipping changes.
- When adding dependencies or scripts, keep `package-lock.json` in sync.

## Troubleshooting
- **Cannot connect to DB:** Verify `.env` values and that the MySQL user has privileges on both schemas.
- **Session/login issues:** Ensure `SESSION_SECRET` is set and the `sessions` table exists (created by `connect-session-sequelize`).
- **Static assets not updating:** Clear browser cache; Express serves from `public/` with long cache headers in production.
- **Locale strings missing:** Add translations under `locales/` and ensure the keys match the usage in Pug templates and controllers.

For questions or operational playbooks, reach out to the GCS engineering contact or log an issue in your internal tracker.
