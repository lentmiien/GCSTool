# Repository Guidelines

## Project Structure & Module Organization
- `app.js` — Express app setup, middleware, and route mounting.
- `bin/www` — server bootstrap (loads `.env`, starts HTTP + Socket.IO).
- `routes/` — Express routers (e.g., `routes/ct.js`).
- `controllers/` — Request handlers (e.g., `ctController.js`).
- `models/` — Sequelize models (MySQL) and related submodules.
- `views/` — Pug templates; names generally mirror routes.
- `public/` — Static assets (`stylesheets/`, `javascripts/`, `js/`).
- `services/`, `utils/` — App services and helpers (e.g., `utils/ChatGPT.js`).
- `sequelize.js` — Model registration and DB relations; runs `sequelize.sync()`.
- `env_sample` — Template for local configuration.

## Build, Run, and Development
- Prereqs: Node `16.20.2`, MySQL. Copy env: `cp env_sample .env` (Windows: `copy env_sample .env`).
- Install deps: `npm install`.
- Run locally: `npm start` (listens on `PORT` or `3000`).
- DB: ensure the `.env` values for `DB_HOST`, `DB_NAME_GCS`, `DB_NAME_TRACK`, `DB_USER`, `DB_PASS` are valid.

## Coding Style & Naming Conventions
- JavaScript: 2-space indent, single quotes, semicolons, CommonJS `require`/`module.exports`.
- Naming: camelCase for vars/functions; PascalCase for Sequelize models (e.g., `User`, `Entry`).
- Files: routes are lowercase (e.g., `routes/hs.js`); controllers end with `Controller.js`; keep existing view naming.
- Keep changes minimal and consistent with neighboring code.

## Testing Guidelines
- No automated tests are configured yet. Before PRs, smoke-test key flows: auth, Entries, Scheduler, CT, PMT, file upload, and locale switching.
- If adding tests, prefer Jest + Supertest. Place in `tests/` and name `*.test.js`. Example: `npx jest` (add `"test"` script when introducing Jest).

## Commit & Pull Request Guidelines
- Commits: short, present tense. Prefer focused changes. Example: `fix: correct variable name in tracker view` or `feat: add PMT version log`.
- PRs should include:
  - Summary, rationale, and affected areas (routes/controllers/views/models).
  - Steps to reproduce and test, and screenshots for UI changes.
  - Linked issues and any DB or backward-compatibility notes.

## Security & Configuration Tips
- Create a local `.env` from `env_sample`; never commit secrets. Set `SESSION_SECRET`, DB creds, and optional `OPENAI_API_KEY*`.
- Use a non-root MySQL user; restrict host access. Back up DB before schema-affecting changes (note: `sequelize.sync()` creates tables on startup).
- Avoid logging sensitive data; sanitize user inputs with existing validators.

